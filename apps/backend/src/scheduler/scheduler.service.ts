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
import { toMonitorDto, toSubtaskDto } from '../common/mappers';
import {
  MonitorResultStatus,
  SubtaskStatus,
  type MonitorResult,
} from '@todo-platform/shared-types';
import type { EnvConfig } from '../config/env.validation';

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
      include: { subtask: true },
    });

    if (!monitor || !monitor.enabled) return;

    const provider = this.registry.resolve(monitor.type);
    const result = await provider.check(monitor.config);

    const nextRunAt = this.computeNextRun(monitor.cron);

    const updated = await this.prisma.monitor.update({
      where: { id: monitorId },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
        lastResult: result as unknown as object,
      },
    });

    await this.syncSubtaskStatus(monitor.subtaskId, result);

    const dto = toMonitorDto(updated);
    this.events.broadcast('monitor.updated', dto);
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
