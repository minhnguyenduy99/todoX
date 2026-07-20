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
import { toMonitorDto, toMonitorResult, toReleaseDto, toSubtaskDto, toTodoDto } from '../common/mappers';
import { resolveTodoStatusOnDeploySuccess } from '../common/todo-deployment-status-sync';
import {
  aggregateReleaseStatus,
  mapMonitorResultToDeploymentStatus,
  shouldApplyFirstSuccessSideEffect,
} from '../common/release-deployment-status-sync';
import {
  MonitorResultStatus,
  ReleaseDeploymentStatus,
  SubtaskStatus,
  TodoStatus,
  type MonitorResult,
} from '@todo-platform/shared-types';
import type { EnvConfig } from '../config/env.validation';
import type { Prisma } from '@prisma/client';

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
      include: { subtask: true, todo: true, releaseDeployment: true },
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
        previousResult,
        result,
      );
      const dto = toMonitorDto(updated);
      this.events.broadcast('monitor.updated', dto);
      return;
    }

    const todoId = monitor.todoId ?? monitor.subtask?.todoId ?? null;

    if (monitor.subtaskId) {
      await this.syncSubtaskStatus(monitor.subtaskId, result);
    }

    const nextTodoStatus = todoId
      ? resolveTodoStatusOnDeploySuccess(
          previousResult,
          result,
          monitor.type,
          monitor.config,
        )
      : null;

    if (todoId && nextTodoStatus) {
      await this.syncTodoStatusOnDeploySuccess(todoId, nextTodoStatus);
    } else if (monitor.todoId) {
      await this.broadcastTodoUpdated(monitor.todoId);
    }

    const dto = toMonitorDto(updated);
    this.events.broadcast('monitor.updated', dto);
  }

  private async syncReleaseDeploymentMonitor(
    releaseDeploymentId: string,
    previousResult: MonitorResult | null,
    result: MonitorResult,
  ): Promise<void> {
    const deployment = await this.prisma.releaseDeployment.findUnique({
      where: { id: releaseDeploymentId },
      include: {
        release: {
          include: {
            members: { include: { todo: true } },
            deployments: true,
          },
        },
      },
    });
    if (!deployment) return;

    const previousStatus = deployment.status as ReleaseDeploymentStatus;
    const nextStatus = mapMonitorResultToDeploymentStatus(result);

    await this.prisma.releaseDeployment.update({
      where: { id: releaseDeploymentId },
      data: { status: nextStatus },
    });

    if (shouldApplyFirstSuccessSideEffect(previousStatus, nextStatus)) {
      if (deployment.release.type === 'staging') {
        await this.completeStagingTodosForService(
          deployment.releaseId,
          deployment.serviceId,
        );
      } else if (deployment.release.type === 'prod') {
        await this.archiveProdTodosForService(
          deployment.releaseId,
          deployment.serviceId,
        );
      }
    }

    await this.reaggregateAndBroadcastRelease(deployment.releaseId);
  }

  private async completeStagingTodosForService(
    releaseId: string,
    serviceId: string,
  ): Promise<void> {
    const members = await this.prisma.releaseMember.findMany({
      where: { releaseId },
      include: { todo: true },
    });
    const todoIds = members
      .filter((member) => member.todo.serviceId === serviceId)
      .map((member) => member.todoId);

    if (!todoIds.length) return;

    await this.prisma.todo.updateMany({
      where: { id: { in: todoIds } },
      data: { status: 'COMPLETED' },
    });

    for (const todoId of todoIds) {
      await this.broadcastTodoUpdated(todoId);
    }
  }

  private async archiveProdTodosForService(
    releaseId: string,
    serviceId: string,
  ): Promise<void> {
    const members = await this.prisma.releaseMember.findMany({
      where: { releaseId },
      include: {
        todo: {
          include: {
            associatedTickets: true,
            pullRequests: true,
          },
        },
      },
    });

    const toArchive = members.filter(
      (member) => member.todo.serviceId === serviceId,
    );

    for (const member of toArchive) {
      const todo = member.todo;
      await this.prisma.$transaction(async (tx) => {
        await tx.completedTodo.create({
          data: {
            originalTodoId: todo.id,
            releaseId,
            title: todo.title,
            description: todo.description,
            status: todo.status,
            serviceId: todo.serviceId,
            associatedTickets: todo.associatedTickets.map((ticket) => ({
              id: ticket.id,
              title: ticket.title,
              type: ticket.type,
              link: ticket.link,
            })) as Prisma.InputJsonValue,
            pullRequests: todo.pullRequests.map((pr) => ({
              id: pr.id,
              number: pr.number,
              title: pr.title,
              status: pr.status,
              url: pr.url,
            })) as Prisma.InputJsonValue,
            createdAt: todo.createdAt,
            updatedAt: todo.updatedAt,
          },
        });
        await tx.todo.delete({ where: { id: todo.id } });
      });
      this.events.broadcast('todo.deleted', { id: todo.id });
    }
  }

  private async reaggregateAndBroadcastRelease(releaseId: string): Promise<void> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        members: { include: { todo: { include: { service: true } } } },
        deployments: { include: { service: true, monitor: true } },
        completedTodos: { include: { service: true } },
      },
    });
    if (!release) return;

    const memberServiceIds = [
      ...new Set(
        [
          ...release.members
            .map((m) => m.todo.serviceId)
            .filter((id): id is string => id != null),
          ...release.completedTodos
            .map((c) => c.serviceId)
            .filter((id): id is string => id != null),
        ],
      ),
    ];

    const deploymentsByServiceId = new Map(
      release.deployments.map((d) => [
        d.serviceId,
        d.status as ReleaseDeploymentStatus,
      ]),
    );

    const nextReleaseStatus = aggregateReleaseStatus(
      memberServiceIds,
      deploymentsByServiceId,
    );

    const updated = await this.prisma.release.update({
      where: { id: releaseId },
      data: { status: nextReleaseStatus },
      include: {
        members: { include: { todo: { include: { service: true } } } },
        deployments: { include: { service: true, monitor: true } },
        completedTodos: { include: { service: true } },
      },
    });

    // Clear currentReleaseId when release becomes terminal
    if (
      nextReleaseStatus === 'successful' ||
      nextReleaseStatus === 'partial_success' ||
      nextReleaseStatus === 'failed'
    ) {
      await this.prisma.todo.updateMany({
        where: { currentReleaseId: releaseId },
        data: { currentReleaseId: null },
      });
    }

    this.events.broadcast('release.updated', toReleaseDto(updated));
  }

  private async syncTodoStatusOnDeploySuccess(
    todoId: string,
    status: TodoStatus,
  ): Promise<void> {
    await this.prisma.todo.update({
      where: { id: todoId },
      data: { status },
    });
    await this.broadcastTodoUpdated(todoId);
  }

  private async broadcastTodoUpdated(todoId: string): Promise<void> {
    const todo = await this.prisma.todo.findUnique({
      where: { id: todoId },
      include: {
        monitor: true,
        subtasks: {
          include: {
            monitor: true,
            pullRequests: { orderBy: { number: 'asc' } },
            deployedEnvironments: { orderBy: { name: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
        pullRequests: { orderBy: { number: 'asc' } },
        deployedEnvironments: { orderBy: { name: 'asc' } },
      },
    });

    if (todo) {
      this.events.broadcast('todo.updated', toTodoDto(todo));
    }
  }

  private async syncSubtaskStatus(
    subtaskId: string,
    result: MonitorResult,
  ): Promise<void> {
    let status: SubtaskStatus | undefined;
    if (result.status === MonitorResultStatus.SUCCESS) {
      status = SubtaskStatus.COMPLETED;
    } else if (result.status === MonitorResultStatus.FAILED) {
      status = SubtaskStatus.FAILED;
    } else if (result.status === MonitorResultStatus.RUNNING) {
      status = SubtaskStatus.IN_PROGRESS;
    }

    if (!status) return;

    const subtask = await this.prisma.subtask.update({
      where: { id: subtaskId },
      data: { status },
      include: { monitor: true },
    });

    this.events.broadcast('subtask.updated', toSubtaskDto(subtask));
  }

  private computeNextRun(cron: string): Date {
    const interval = parser.parseExpression(cron);
    return interval.next().toDate();
  }
}
