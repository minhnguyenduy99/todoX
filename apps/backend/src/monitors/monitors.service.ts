import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { SchedulerService } from '../scheduler/scheduler.service';
import { toMonitorDto, toMonitorResult } from '../common/mappers';
import { extractDeploymentInfo } from '../common/deployment-enrichment';
import { resolveMonitorEnvKey } from '../common/monitor-env-key';
import type {
  CreateMonitorDto,
  DeploymentMonitorConfig,
  MonitorDto,
  UpdateMonitorDto,
} from '@todo-platform/shared-types';
import { MonitorType } from '@todo-platform/shared-types';
import { normalizeDeploymentMonitorConfig } from '../common/parse-jenkins-job-url';
import { Prisma } from '@prisma/client';
import parser from 'cron-parser';

@Injectable()
export class MonitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    @Inject(forwardRef(() => SchedulerService))
    private readonly scheduler: SchedulerService,
  ) {}

  async findAll(): Promise<MonitorDto[]> {
    const monitors = await this.prisma.monitor.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return monitors.map(toMonitorDto);
  }

  async findOne(id: string): Promise<MonitorDto> {
    const monitor = await this.prisma.monitor.findUnique({ where: { id } });
    if (!monitor) throw new NotFoundException(`Monitor ${id} not found`);
    return toMonitorDto(monitor);
  }

  async findDeploymentMonitorForTodo(
    todoId: string,
    envKey: string,
  ): Promise<MonitorDto | null> {
    const monitor = await this.prisma.monitor.findFirst({
      where: { todoId, envKey },
    });
    return monitor ? toMonitorDto(monitor) : null;
  }

  async create(
    subtaskId: string,
    dto: CreateMonitorDto,
    options?: { silent?: boolean },
  ): Promise<MonitorDto> {
    const subtask = await this.prisma.subtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException(`Subtask ${subtaskId} not found`);

    if (dto.type === MonitorType.DEPLOYMENT) {
      return this.upsertForSubtask(subtaskId, dto, options);
    }

    const envKey = this.requireEnvKey(dto.type, dto.config);
    const existing = await this.prisma.monitor.findFirst({
      where: { subtaskId, envKey },
    });
    if (existing) {
      throw new ConflictException(
        `Subtask ${subtaskId} already has a ${dto.type} monitor`,
      );
    }

    return this.createMonitor({ subtaskId }, dto, envKey, options);
  }

  async createForTodo(
    todoId: string,
    dto: CreateMonitorDto,
    options?: { silent?: boolean },
  ): Promise<MonitorDto> {
    return this.upsertForTodo(todoId, dto, options);
  }

  async upsertForTodo(
    todoId: string,
    dto: CreateMonitorDto | UpdateMonitorDto,
    options?: { silent?: boolean; clearLastResult?: boolean },
  ): Promise<MonitorDto> {
    const todo = await this.prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) throw new NotFoundException(`Todo ${todoId} not found`);

    const envKey = this.requireEnvKey(dto.type, dto.config);
    const existing = await this.prisma.monitor.findFirst({
      where: { todoId, envKey },
    });

    if (existing) {
      return this.update(existing.id, dto, options);
    }

    if (!dto.type || !dto.cron || !dto.config) {
      throw new BadRequestException(
        'Provide type, cron, and config to create a monitor',
      );
    }

    return this.createMonitor({ todoId }, dto as CreateMonitorDto, envKey, options);
  }

  async upsertForSubtask(
    subtaskId: string,
    dto: CreateMonitorDto | UpdateMonitorDto,
    options?: { silent?: boolean; clearLastResult?: boolean },
  ): Promise<MonitorDto> {
    const subtask = await this.prisma.subtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException(`Subtask ${subtaskId} not found`);

    const envKey = this.requireEnvKey(dto.type, dto.config);
    const existing = await this.prisma.monitor.findFirst({
      where: { subtaskId, envKey },
    });

    if (existing) {
      return this.update(existing.id, dto, options);
    }

    if (!dto.type || !dto.cron || !dto.config) {
      throw new BadRequestException(
        'Provide type, cron, and config to create a monitor',
      );
    }

    return this.createMonitor(
      { subtaskId },
      dto as CreateMonitorDto,
      envKey,
      options,
    );
  }

  private async createMonitor(
    owner:
      | { subtaskId: string }
      | { todoId: string }
      | { releaseDeploymentId: string }
      | { releaseId: string }
      | { testcaseScanId: string },
    dto: CreateMonitorDto,
    envKey: string | null,
    options?: { silent?: boolean },
  ): Promise<MonitorDto> {
    this.validateCron(dto.cron);

    const nextRunAt = this.computeNextRun(dto.cron);

    const monitor = await this.prisma.monitor.create({
      data: {
        ...owner,
        envKey,
        type: dto.type,
        cron: dto.cron,
        enabled: dto.enabled ?? true,
        config: this.normalizeMonitorConfig(dto.type, dto.config) as Prisma.InputJsonValue,
        nextRunAt,
      },
    });

    if (monitor.enabled) {
      await this.scheduler.scheduleMonitor(monitor.id, monitor.cron);
      if (
        dto.type === MonitorType.TESTCASE_SCAN ||
        dto.type === MonitorType.DEPLOYMENT_DISCOVERY ||
        dto.type === MonitorType.DEPLOYMENT
      ) {
        this.scheduler.runMonitorNow(monitor.id);
      }
    }

    const result = toMonitorDto(monitor);
    if (!options?.silent) {
      this.events.broadcast('monitor.created', result);
    }
    return result;
  }

  async createForReleaseDeployment(
    releaseDeploymentId: string,
    dto: CreateMonitorDto,
    options?: { silent?: boolean },
  ): Promise<MonitorDto> {
    const deployment = await this.prisma.releaseDeployment.findUnique({
      where: { id: releaseDeploymentId },
    });
    if (!deployment) {
      throw new NotFoundException(`ReleaseDeployment ${releaseDeploymentId} not found`);
    }

    const existing = await this.prisma.monitor.findUnique({
      where: { releaseDeploymentId },
    });
    if (existing) {
      await this.remove(existing.id);
    }

    const envKey = this.requireEnvKey(dto.type, dto.config);
    return this.createMonitor({ releaseDeploymentId }, dto, envKey, options);
  }

  async createForRelease(
    releaseId: string,
    dto: CreateMonitorDto,
    options?: { silent?: boolean },
  ): Promise<MonitorDto> {
    const release = await this.prisma.release.findUnique({ where: { id: releaseId } });
    if (!release) {
      throw new NotFoundException(`Release ${releaseId} not found`);
    }

    const existing = await this.prisma.monitor.findUnique({ where: { releaseId } });
    if (existing) {
      await this.remove(existing.id);
    }

    const envKey = resolveMonitorEnvKey(dto.type, dto.config);
    return this.createMonitor({ releaseId }, dto, envKey, options);
  }

  async disableAndUnschedule(id: string): Promise<void> {
    const existing = await this.prisma.monitor.findUnique({ where: { id } });
    if (!existing) return;

    await this.scheduler.unscheduleMonitor(id);
    await this.prisma.monitor.update({
      where: { id },
      data: { enabled: false, nextRunAt: null },
    });
  }

  async createForTestcaseScan(
    testcaseScanId: string,
    dto: CreateMonitorDto,
    options?: { silent?: boolean },
  ): Promise<MonitorDto> {
    const scan = await this.prisma.testcaseScan.findUnique({
      where: { id: testcaseScanId },
    });
    if (!scan) {
      throw new NotFoundException(`TestcaseScan ${testcaseScanId} not found`);
    }

    const existing = await this.prisma.monitor.findUnique({
      where: { testcaseScanId },
    });
    if (existing) {
      await this.remove(existing.id);
    }

    const envKey = resolveMonitorEnvKey(dto.type, dto.config);
    return this.createMonitor({ testcaseScanId }, dto, envKey, options);
  }

  async update(
    id: string,
    dto: UpdateMonitorDto,
    options?: { silent?: boolean; clearLastResult?: boolean },
  ): Promise<MonitorDto> {
    const existing = await this.prisma.monitor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Monitor ${id} not found`);

    if (dto.cron) this.validateCron(dto.cron);

    const cron = dto.cron ?? existing.cron;
    const type = (dto.type ?? existing.type) as MonitorType;
    const normalizedConfig = dto.config
      ? this.normalizeMonitorConfig(type, dto.config)
      : null;
    const config = (normalizedConfig ??
      (existing.config as Record<string, unknown>)) as Record<string, unknown>;
    const envKey = resolveMonitorEnvKey(type, config) ?? existing.envKey;

    let enabled = dto.enabled ?? existing.enabled;
    let clearLastResult = options?.clearLastResult ?? false;
    const pollTargetChanged = this.didPollTargetChange(
      existing.type as MonitorType,
      existing.config as Record<string, unknown>,
      type,
      dto.config,
    );

    if (pollTargetChanged) {
      clearLastResult = true;
      if (dto.enabled === undefined) {
        enabled = true;
      }
    } else if (
      type === MonitorType.DEPLOYMENT &&
      this.isDeploymentResultStale(existing, config)
    ) {
      clearLastResult = true;
      if (dto.enabled === undefined) {
        enabled = true;
      }
    }

    const shouldRunNow =
      pollTargetChanged ||
      (type === MonitorType.DEPLOYMENT &&
        this.isDeploymentResultStale(existing, config));

    const monitor = await this.prisma.monitor.update({
      where: { id },
      data: {
        type: dto.type,
        cron: dto.cron,
        enabled,
        envKey,
        config: normalizedConfig
          ? (normalizedConfig as Prisma.InputJsonValue)
          : undefined,
        nextRunAt: enabled ? this.computeNextRun(cron) : null,
        ...(clearLastResult ? { lastResult: Prisma.DbNull } : {}),
      },
    });

    await this.scheduler.unscheduleMonitor(id);
    if (monitor.enabled) {
      await this.scheduler.scheduleMonitor(monitor.id, monitor.cron);
      if (
        shouldRunNow &&
        (type === MonitorType.DEPLOYMENT ||
          type === MonitorType.TESTCASE_SCAN ||
          type === MonitorType.DEPLOYMENT_DISCOVERY)
      ) {
        this.scheduler.runMonitorNow(monitor.id);
      }
    }

    const result = toMonitorDto(monitor);
    if (!options?.silent) {
      this.events.broadcast('monitor.updated', result);
    }
    return result;
  }

  runMonitorNow(monitorId: string): void {
    this.scheduler.runMonitorNow(monitorId);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.monitor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Monitor ${id} not found`);

    await this.scheduler.unscheduleMonitor(id);
    await this.prisma.monitor.delete({ where: { id } });
    this.events.broadcast('monitor.deleted', { id });
  }

  private requireEnvKey(
    type: MonitorType | string | undefined,
    config: Record<string, unknown> | undefined,
  ): string {
    if (!type) {
      throw new BadRequestException('Monitor type is required');
    }
    const envKey = resolveMonitorEnvKey(type, config);
    if (!envKey) {
      throw new BadRequestException(
        'Deployment monitors require config.env; other monitors require a valid type',
      );
    }
    return envKey;
  }

  private normalizeMonitorConfig(
    type: MonitorType,
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    if (type !== MonitorType.DEPLOYMENT) {
      return config;
    }
    return normalizeDeploymentMonitorConfig(
      config as unknown as DeploymentMonitorConfig,
    ) as unknown as Record<string, unknown>;
  }

  private didPollTargetChange(
    existingType: MonitorType,
    existingConfig: Record<string, unknown>,
    nextType: MonitorType,
    incomingConfig: Record<string, unknown> | undefined,
  ): boolean {
    if (!incomingConfig) return false;

    if (
      existingType === MonitorType.DEPLOYMENT &&
      nextType === MonitorType.DEPLOYMENT
    ) {
      const prev = normalizeDeploymentMonitorConfig(
        existingConfig as unknown as DeploymentMonitorConfig,
      );
      const next = normalizeDeploymentMonitorConfig(
        incomingConfig as unknown as DeploymentMonitorConfig,
      );
      return (
        prev.jobUrl !== next.jobUrl || prev.buildNumber !== next.buildNumber
      );
    }

    if (
      existingType === MonitorType.TESTCASE_SCAN &&
      nextType === MonitorType.TESTCASE_SCAN
    ) {
      const prev = existingConfig as { jobUrl?: string; buildNumber?: number };
      const next = incomingConfig as { jobUrl?: string; buildNumber?: number };
      return (
        prev.jobUrl !== next.jobUrl || prev.buildNumber !== next.buildNumber
      );
    }

    return false;
  }

  private isDeploymentResultStale(
    existing: { type: string; config: unknown; lastResult: unknown },
    config: Record<string, unknown>,
  ): boolean {
    if (existing.type !== MonitorType.DEPLOYMENT) return false;

    const target = normalizeDeploymentMonitorConfig(
      config as unknown as DeploymentMonitorConfig,
    );
    const deployment = extractDeploymentInfo(
      toMonitorResult(existing.lastResult),
    );
    if (!deployment) return true;
    return deployment.buildNumber !== target.buildNumber;
  }

  private validateCron(cron: string): void {
    try {
      parser.parseExpression(cron);
    } catch {
      throw new ConflictException(`Invalid cron expression: ${cron}`);
    }
  }

  private computeNextRun(cron: string): Date {
    const interval = parser.parseExpression(cron);
    return interval.next().toDate();
  }
}
