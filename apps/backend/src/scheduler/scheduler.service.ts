import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import parser from 'cron-parser';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { MonitorProviderRegistry } from '../monitors/providers/monitor-provider.registry';
import { toMonitorDto, toMonitorResult, toSubtaskDto, toTodoDto } from '../common/mappers';
import {
  isTodoStatusSyncSuppressedForDeploymentMonitor,
  resolveTodoStatusFromSuccessfulDeployPoll,
  shouldApplyTodoStatusTransition,
  shouldKeepDeploymentMonitorActiveAfterPoll,
} from '../common/todo-deployment-status-sync';
import { todoStatusUpdateData } from '../common/todo-status-update';
import {
  deploymentMetaFromConfigAndResult,
} from '../notifications/notifications.service';
import {
  isFirstMonitorTerminalTransition,
  isSubtaskTerminalTransition,
  isTestcaseScanTerminalTransition,
} from '../common/notification-transitions';
import { NON_TERMINAL_RELEASE_STATUSES, TERMINAL_RELEASE_STATUSES } from '../common/release-constants';
import { mapMonitorResultToDeploymentStatus } from '../common/release-deployment-status-sync';
import { isDeploymentMonitorPollError } from '../common/monitor-poll-error';
import {
  isTerminalTestcaseScanStatus,
  mapMonitorResultToTestcaseScanBuildResult,
  mapMonitorResultToTestcaseScanStatus,
} from '../common/testcase-scan-status-sync';
import {
  MonitorResultStatus,
  MonitorType,
  ReleaseDeploymentStatus,
  ReleaseStatus,
  SubtaskStatus,
  TodoStatus,
  TestcaseScanStatus,
  type MonitorResult,
} from '@todo-platform/shared-types';
import type { EnvConfig } from '../config/env.validation';
import { ReleasesService } from '../releases/releases.service';
import { ReleaseDeploymentDiscoveryService } from '../releases/release-deployment-discovery.service';
import { NotificationsService } from '../notifications/notifications.service';

export const MONITOR_QUEUE = 'monitor-checks';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    @Inject(forwardRef(() => MonitorProviderRegistry))
    private readonly registry: MonitorProviderRegistry,
    private readonly logger: Logger,
    @Inject(forwardRef(() => ReleasesService))
    private readonly releasesService: ReleasesService,
    @Inject(forwardRef(() => ReleaseDeploymentDiscoveryService))
    private readonly releaseDeploymentDiscovery: ReleaseDeploymentDiscoveryService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get('REDIS_URL', { infer: true });
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    this.queue = new Queue(MONITOR_QUEUE, { connection: this.connection });

    this.worker = new Worker(
      MONITOR_QUEUE,
      async (job: Job<{ monitorId: string }>) => this.executeMonitor(job.data.monitorId),
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error({ jobId: job?.id, err }, 'Monitor job failed');
    });

    await this.loadExistingMonitors();
    this.logger.log('Scheduler initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
    this.logger.log('Scheduler shut down');
  }

  async scheduleMonitor(monitorId: string, cron: string): Promise<void> {
    await this.unscheduleMonitor(monitorId);
    await this.queue.add(
      'check',
      { monitorId },
      {
        jobId: `monitor-${monitorId}`,
        repeat: { pattern: cron },
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  }

  runMonitorNow(monitorId: string): void {
    void this.executeMonitor(monitorId).catch((err) => {
      this.logger.error({ monitorId, err }, 'Immediate monitor check failed');
    });
  }

  async unscheduleMonitor(monitorId: string): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const job = repeatableJobs.find((j) => j.id === `monitor-${monitorId}`);
    if (job) {
      await this.queue.removeRepeatableByKey(job.key);
    }
  }

  private async loadExistingMonitors(): Promise<void> {
    await this.recoverReleaseDeploymentsFromPollErrors();
    await this.backfillActiveReleaseTodoStagingMonitors();
    await this.disableMonitorsForTerminalReleases();
    const monitors = await this.prisma.monitor.findMany({ where: { enabled: true } });
    for (const monitor of monitors) {
      await this.scheduleMonitor(monitor.id, monitor.cron);
    }
    this.logger.log(`Loaded ${monitors.length} monitor jobs`);
  }

  /** Re-open release deployments that were marked failed due to Jenkins poll errors only. */
  private async recoverReleaseDeploymentsFromPollErrors(): Promise<void> {
    const deployments = await this.prisma.releaseDeployment.findMany({
      where: { status: ReleaseDeploymentStatus.FAILED },
      include: { monitor: true },
    });

    const releaseIds = new Set<string>();

    for (const deployment of deployments) {
      if (!deployment.monitor) continue;
      const lastResult = toMonitorResult(deployment.monitor.lastResult);
      if (!lastResult || !isDeploymentMonitorPollError(lastResult)) continue;

      await this.prisma.releaseDeployment.update({
        where: { id: deployment.id },
        data: { status: ReleaseDeploymentStatus.IN_PROGRESS },
      });
      releaseIds.add(deployment.releaseId);

      if (!deployment.monitor.enabled) {
        const nextRunAt = this.computeNextRun(deployment.monitor.cron);
        await this.prisma.monitor.update({
          where: { id: deployment.monitor.id },
          data: { enabled: true, nextRunAt },
        });
        await this.scheduleMonitor(deployment.monitor.id, deployment.monitor.cron);
      }
    }

    for (const releaseId of releaseIds) {
      await this.releasesService.reaggregateAndBroadcast(releaseId);
      await this.releasesService.backfillMemberTodoStagingMonitorsForRelease(releaseId);
    }

    if (releaseIds.size > 0) {
      this.logger.log(
        `Recovered ${releaseIds.size} release(s) from poll-error deployment failures`,
      );
    }
  }

  /** Sync release deployment chips onto member todos for active staging releases. */
  private async backfillActiveReleaseTodoStagingMonitors(): Promise<void> {
    const releases = await this.prisma.release.findMany({
      where: {
        type: 'staging',
        status: { in: NON_TERMINAL_RELEASE_STATUSES },
        deployments: { some: {} },
      },
      select: { id: true },
    });

    for (const release of releases) {
      await this.releasesService.backfillMemberTodoStagingMonitorsForRelease(release.id);
    }
  }

  private async disableMonitorsForTerminalReleases(): Promise<void> {
    const stale = await this.prisma.monitor.findMany({
      where: {
        enabled: true,
        OR: [
          {
            releaseDeployment: {
              release: { status: { in: TERMINAL_RELEASE_STATUSES } },
            },
          },
          { release: { status: { in: TERMINAL_RELEASE_STATUSES } } },
        ],
      },
      select: { id: true },
    });
    for (const monitor of stale) {
      await this.disableDeploymentMonitor(monitor.id);
    }
    if (stale.length > 0) {
      this.logger.log(`Disabled ${stale.length} monitors on terminal releases`);
    }
  }

  async executeMonitor(monitorId: string): Promise<void> {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      include: { subtask: true, todo: true, releaseDeployment: true, testcaseScan: true },
    });

    if (!monitor || !monitor.enabled) return;

    const provider = this.registry.resolve(monitor.type);
    const result = await provider.check(monitor.config);

    const nextRunAt = this.computeNextRun(monitor.cron);

    const previousResult = toMonitorResult(monitor.lastResult);

    const updated = await this.prisma.monitor.update({
      where: { id: monitorId },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
        lastResult: result as unknown as object,
      },
    });

    if (monitor.releaseDeploymentId) {
      await this.syncReleaseDeploymentMonitor(
        monitorId,
        monitor.releaseDeploymentId,
        result,
      );
      const dto = toMonitorDto(updated);
      this.events.broadcast('monitor.updated', dto);
      return;
    }

    if (monitor.releaseId && monitor.type === MonitorType.DEPLOYMENT_DISCOVERY) {
      await this.syncReleaseDiscoveryMonitor(monitor.id, monitor.releaseId, result);
      const dto = toMonitorDto(updated);
      this.events.broadcast('monitor.updated', dto);
      return;
    }

    if (monitor.testcaseScanId) {
      await this.syncTestcaseScanMonitor(monitor.testcaseScanId, result, monitorId);
      const dto = toMonitorDto(updated);
      this.events.broadcast('monitor.updated', dto);
      return;
    }

    const todoId = monitor.todoId ?? monitor.subtask?.todoId ?? null;

    let todoForStatusSync: {
      status: TodoStatus;
      pullRequests: { status: string }[];
    } | null = null;

    if (todoId && monitor.type === MonitorType.DEPLOYMENT) {
      const todo = await this.prisma.todo.findUnique({
        where: { id: todoId },
        select: {
          status: true,
          pullRequests: { select: { status: true } },
        },
      });
      if (todo) {
        todoForStatusSync = {
          status: todo.status as TodoStatus,
          pullRequests: todo.pullRequests,
        };
      }
    }

    if (monitor.subtaskId) {
      await this.syncSubtaskStatus(monitor, result);
    }

    if (
      monitor.type === MonitorType.DEPLOYMENT &&
      monitor.todoId &&
      !monitor.subtaskId &&
      monitor.todo
    ) {
      const outcome = isFirstMonitorTerminalTransition(previousResult, result);
      if (outcome) {
        const meta = deploymentMetaFromConfigAndResult(monitor.config, result);
        await this.notifications.createForTodoDeployment({
          todoId: monitor.todoId,
          todoTitle: monitor.todo.title,
          env: meta.env,
          buildNumber: meta.buildNumber,
          buildUrl: meta.buildUrl,
          outcome,
        });
      }
    }

    const nextTodoStatus =
      todoForStatusSync != null
        ? resolveTodoStatusFromSuccessfulDeployPoll(
            result,
            monitor.type,
            monitor.config,
            todoForStatusSync.status,
            todoForStatusSync.pullRequests,
          )
        : null;

    const suppressStatusSync =
      isTodoStatusSyncSuppressedForDeploymentMonitor(monitor.config) ||
      (todoId != null && (await this.isTodoOnNonTerminalRelease(todoId)));

    let statusAfterSync = todoForStatusSync?.status ?? null;

    if (todoId && nextTodoStatus && !suppressStatusSync) {
      await this.syncTodoStatusOnDeploySuccess(todoId, nextTodoStatus);
      statusAfterSync = nextTodoStatus;
    } else if (monitor.todoId) {
      await this.broadcastTodoUpdated(monitor.todoId);
    }

    if (
      monitor.type === MonitorType.DEPLOYMENT &&
      !monitor.releaseDeploymentId &&
      !monitor.releaseId &&
      !monitor.testcaseScanId &&
      todoForStatusSync != null &&
      statusAfterSync != null &&
      !shouldKeepDeploymentMonitorActiveAfterPoll(
        result,
        monitor.type,
        monitor.config,
        statusAfterSync,
        todoForStatusSync.pullRequests,
      )
    ) {
      await this.disableDeploymentMonitor(monitorId);
    }

    const dto = toMonitorDto(updated);
    this.events.broadcast('monitor.updated', dto);
  }

  private async disableDeploymentMonitor(monitorId: string): Promise<void> {
    await this.unscheduleMonitor(monitorId);
    await this.prisma.monitor.update({
      where: { id: monitorId },
      data: { enabled: false, nextRunAt: null },
    });
  }

  private async syncTestcaseScanMonitor(
    testcaseScanId: string,
    result: MonitorResult,
    monitorId: string,
  ): Promise<void> {
    const scan = await this.prisma.testcaseScan.findUnique({
      where: { id: testcaseScanId },
    });
    if (!scan) return;

    const nextStatus = mapMonitorResultToTestcaseScanStatus(result);
    if (!nextStatus) return;

    const previousStatus = scan.status as TestcaseScanStatus;
    const buildResult = mapMonitorResultToTestcaseScanBuildResult(result);

    await this.prisma.testcaseScan.update({
      where: { id: testcaseScanId },
      data: { status: nextStatus, buildResult },
    });

    const scanOutcome = isTestcaseScanTerminalTransition(previousStatus, nextStatus);
    if (scanOutcome) {
      const todo = await this.prisma.todo.findUnique({ where: { id: scan.todoId } });
      const scanMeta = result.metadata?.scan as { buildUrl?: string } | undefined;
      await this.notifications.createForTestcaseScan({
        scanId: scan.id,
        scanName: scan.name,
        todoId: scan.todoId,
        todoTitle: todo?.title ?? 'Todo',
        buildUrl: scanMeta?.buildUrl ?? scan.jobUrl,
        outcome: scanOutcome,
      });
    }

    if (isTerminalTestcaseScanStatus(nextStatus)) {
      await this.prisma.monitor.update({
        where: { id: monitorId },
        data: { enabled: false, nextRunAt: null },
      });
      await this.unscheduleMonitor(monitorId);
    }

    await this.broadcastTodoUpdated(scan.todoId);
  }

  private async syncReleaseDiscoveryMonitor(
    monitorId: string,
    releaseId: string,
    result: MonitorResult,
  ): Promise<void> {
    const releaseRecord = await this.prisma.release.findUnique({
      where: { id: releaseId },
      select: { status: true },
    });
    if (releaseRecord && TERMINAL_RELEASE_STATUSES.includes(releaseRecord.status)) {
      await this.disableDeploymentMonitor(monitorId);
      return;
    }

    const discovered = Array.isArray(result.metadata?.discovered)
      ? (result.metadata.discovered as Array<{
          serviceId: string;
          jobUrl: string;
          buildNumber: number;
        }>)
      : [];

    await this.releaseDeploymentDiscovery.applyDiscoveryPollResult(
      monitorId,
      releaseId,
      discovered,
    );

    const release = await this.releasesService.findOne(releaseId);
    this.events.broadcast('release.updated', release);
  }

  private async syncReleaseDeploymentMonitor(
    monitorId: string,
    releaseDeploymentId: string,
    result: MonitorResult,
  ): Promise<void> {
    const deployment = await this.prisma.releaseDeployment.findUnique({
      where: { id: releaseDeploymentId },
      include: { release: true },
    });
    if (!deployment) return;

    const nextStatus = mapMonitorResultToDeploymentStatus(result);
    if (nextStatus === null) {
      return;
    }

    if (TERMINAL_RELEASE_STATUSES.includes(deployment.release.status)) {
      const recoveringFailedRelease =
        deployment.release.status === ReleaseStatus.FAILED &&
        nextStatus !== ReleaseDeploymentStatus.FAILED;
      if (!recoveringFailedRelease) {
        await this.disableDeploymentMonitor(monitorId);
        return;
      }
    }

    const previousStatus = deployment.status as ReleaseDeploymentStatus;

    await this.releasesService.onDeploymentMonitorResult(
      releaseDeploymentId,
      previousStatus,
      nextStatus,
    );

    const deploymentTerminal =
      nextStatus === ReleaseDeploymentStatus.SUCCESSFUL ||
      nextStatus === ReleaseDeploymentStatus.FAILED;

    if (deploymentTerminal) {
      await this.disableDeploymentMonitor(monitorId);
    }
  }

  private async syncTodoStatusOnDeploySuccess(
    todoId: string,
    status: TodoStatus,
  ): Promise<void> {
    const todo = await this.prisma.todo.findUnique({
      where: { id: todoId },
      select: { status: true },
    });
    if (!todo) return;

    const currentStatus = todo.status as TodoStatus;
    if (!shouldApplyTodoStatusTransition(currentStatus, status)) {
      await this.broadcastTodoUpdated(todoId);
      return;
    }

    await this.prisma.todo.update({
      where: { id: todoId },
      data: todoStatusUpdateData(status),
    });
    await this.broadcastTodoUpdated(todoId);
  }

  private async isTodoOnNonTerminalRelease(todoId: string): Promise<boolean> {
    const membership = await this.prisma.releaseMember.findFirst({
      where: {
        todoId,
        release: { status: { in: NON_TERMINAL_RELEASE_STATUSES } },
      },
      select: { id: true },
    });
    return membership != null;
  }

  private async broadcastTodoUpdated(todoId: string): Promise<void> {
    const todo = await this.prisma.todo.findUnique({
      where: { id: todoId },
      include: {
        monitors: true,
        subtasks: {
          include: {
            monitors: true,
        pullRequests: { orderBy: { number: 'asc' } },
        deployedEnvironments: { orderBy: { name: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    },
    pullRequests: { orderBy: { number: 'asc' } },
    deployedEnvironments: { orderBy: { name: 'asc' } },
    testcaseScans: { orderBy: { createdAt: 'desc' } },
  },
});

    if (todo) {
      this.events.broadcast('todo.updated', toTodoDto(todo));
    }
  }

  private async syncSubtaskStatus(
    monitor: {
      id: string;
      subtaskId: string | null;
      type: string;
      config: unknown;
      subtask: { id: string; name: string; todoId: string; status: string } | null;
      todo: { id: string; title: string } | null;
    },
    result: MonitorResult,
  ): Promise<void> {
    if (!monitor.subtaskId || !monitor.subtask) return;

    if (
      monitor.type === MonitorType.DEPLOYMENT &&
      isDeploymentMonitorPollError(result)
    ) {
      return;
    }

    let status: SubtaskStatus | undefined;
    if (result.status === MonitorResultStatus.SUCCESS) {
      status = SubtaskStatus.COMPLETED;
    } else if (result.status === MonitorResultStatus.FAILED) {
      status = SubtaskStatus.FAILED;
    } else if (result.status === MonitorResultStatus.RUNNING) {
      status = SubtaskStatus.IN_PROGRESS;
    }

    if (!status) return;

    const previousStatus = monitor.subtask.status as SubtaskStatus;
    const subtaskOutcome =
      monitor.type === MonitorType.DEPLOYMENT
        ? isSubtaskTerminalTransition(previousStatus, status)
        : null;

    const subtask = await this.prisma.subtask.update({
      where: { id: monitor.subtaskId },
      data: { status },
      include: { monitors: true, todo: true },
    });

    if (subtaskOutcome) {
      const meta = deploymentMetaFromConfigAndResult(monitor.config, result);
      await this.notifications.createForSubtaskDeployment({
        subtaskId: subtask.id,
        subtaskName: subtask.name,
        todoId: subtask.todoId,
        todoTitle: subtask.todo?.title ?? monitor.todo?.title ?? 'Todo',
        env: meta.env,
        buildNumber: meta.buildNumber,
        buildUrl: meta.buildUrl,
        outcome: subtaskOutcome,
      });
    }

    this.events.broadcast('subtask.updated', toSubtaskDto(subtask));
  }

  private computeNextRun(cron: string): Date {
    const interval = parser.parseExpression(cron);
    return interval.next().toDate();
  }
}
