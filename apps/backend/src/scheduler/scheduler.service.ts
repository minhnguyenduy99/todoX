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
  resolveTodoStatusOnDeploySuccess,
  shouldApplyTodoStatusTransition,
} from '../common/todo-deployment-status-sync';
import {
  deploymentMetaFromConfigAndResult,
} from '../notifications/notifications.service';
import {
  isFirstMonitorTerminalTransition,
  isSubtaskTerminalTransition,
  isTestcaseScanTerminalTransition,
} from '../common/notification-transitions';
import { NON_TERMINAL_RELEASE_STATUSES } from '../common/release-constants';
import { mapMonitorResultToDeploymentStatus } from '../common/release-deployment-status-sync';
import {
  isTerminalTestcaseScanStatus,
  mapMonitorResultToTestcaseScanBuildResult,
  mapMonitorResultToTestcaseScanStatus,
} from '../common/testcase-scan-status-sync';
import {
  MonitorResultStatus,
  MonitorType,
  ReleaseDeploymentStatus,
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
    const monitors = await this.prisma.monitor.findMany({ where: { enabled: true } });
    for (const monitor of monitors) {
      await this.scheduleMonitor(monitor.id, monitor.cron);
    }
    this.logger.log(`Loaded ${monitors.length} monitor jobs`);
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

    const nextTodoStatus = todoId
      ? resolveTodoStatusOnDeploySuccess(
          previousResult,
          result,
          monitor.type,
          monitor.config,
        )
      : null;

    const suppressStatusSync =
      isTodoStatusSyncSuppressedForDeploymentMonitor(monitor.config) ||
      (todoId != null && (await this.isTodoOnNonTerminalRelease(todoId)));

    if (todoId && nextTodoStatus && !suppressStatusSync) {
      await this.syncTodoStatusOnDeploySuccess(todoId, nextTodoStatus);
    } else if (monitor.todoId) {
      await this.broadcastTodoUpdated(monitor.todoId);
    }

    const dto = toMonitorDto(updated);
    this.events.broadcast('monitor.updated', dto);
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
    releaseDeploymentId: string,
    result: MonitorResult,
  ): Promise<void> {
    const deployment = await this.prisma.releaseDeployment.findUnique({
      where: { id: releaseDeploymentId },
    });
    if (!deployment) return;

    const previousStatus = deployment.status as ReleaseDeploymentStatus;
    const nextStatus = mapMonitorResultToDeploymentStatus(result);

    await this.releasesService.onDeploymentMonitorResult(
      releaseDeploymentId,
      previousStatus,
      nextStatus,
    );
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
      data: { status },
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
