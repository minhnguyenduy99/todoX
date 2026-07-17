import { Injectable, NotFoundException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { SchedulerService } from '../scheduler/scheduler.service';
import { toMonitorDto } from '../common/mappers';
import type { CreateMonitorDto, MonitorDto, UpdateMonitorDto } from '@todo-platform/shared-types';
import type { Prisma } from '@prisma/client';
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

  async create(
    subtaskId: string,
    dto: CreateMonitorDto,
    options?: { silent?: boolean },
  ): Promise<MonitorDto> {
    const subtask = await this.prisma.subtask.findUnique({ where: { id: subtaskId } });
    if (!subtask) throw new NotFoundException(`Subtask ${subtaskId} not found`);

    const existing = await this.prisma.monitor.findUnique({ where: { subtaskId } });
    if (existing) {
      throw new ConflictException(`Subtask ${subtaskId} already has a monitor`);
    }

    this.validateCron(dto.cron);

    const nextRunAt = this.computeNextRun(dto.cron);

    const monitor = await this.prisma.monitor.create({
      data: {
        subtaskId,
        type: dto.type,
        cron: dto.cron,
        enabled: dto.enabled ?? true,
        config: dto.config as Prisma.InputJsonValue,
        nextRunAt,
      },
    });

    if (monitor.enabled) {
      await this.scheduler.scheduleMonitor(monitor.id, monitor.cron);
    }

    const result = toMonitorDto(monitor);
    if (!options?.silent) {
      this.events.broadcast('monitor.created', result);
    }
    return result;
  }

  async update(
    id: string,
    dto: UpdateMonitorDto,
    options?: { silent?: boolean },
  ): Promise<MonitorDto> {
    const existing = await this.prisma.monitor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Monitor ${id} not found`);

    if (dto.cron) this.validateCron(dto.cron);

    const cron = dto.cron ?? existing.cron;
    const enabled = dto.enabled ?? existing.enabled;

    const monitor = await this.prisma.monitor.update({
      where: { id },
      data: {
        type: dto.type,
        cron: dto.cron,
        enabled: dto.enabled,
        config: dto.config as Prisma.InputJsonValue | undefined,
        nextRunAt: enabled ? this.computeNextRun(cron) : null,
      },
    });

    await this.scheduler.unscheduleMonitor(id);
    if (monitor.enabled) {
      await this.scheduler.scheduleMonitor(monitor.id, monitor.cron);
    }

    const result = toMonitorDto(monitor);
    if (!options?.silent) {
      this.events.broadcast('monitor.updated', result);
    }
    return result;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.monitor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Monitor ${id} not found`);

    await this.scheduler.unscheduleMonitor(id);
    await this.prisma.monitor.delete({ where: { id } });
    this.events.broadcast('monitor.deleted', { id });
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
