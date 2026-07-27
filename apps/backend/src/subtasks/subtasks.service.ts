import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { MonitorsService } from '../monitors/monitors.service';
import { syncPullRequests } from '../common/pull-requests';
import { syncDeployedEnvironments } from '../common/deployed-environments';
import { toSubtaskDto } from '../common/mappers';
import type {
  CreateSubtaskDto,
  SubtaskDto,
  UpdateSubtaskDto,
} from '@todo-platform/shared-types';
import { MonitorType } from '@todo-platform/shared-types';

const subtaskInclude = {
  monitors: true,
  pullRequests: {
    orderBy: { number: 'asc' as const },
  },
  deployedEnvironments: {
    orderBy: { name: 'asc' as const },
  },
};

@Injectable()
export class SubtasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly monitorsService: MonitorsService,
  ) {}

  async create(todoId: string, dto: CreateSubtaskDto): Promise<SubtaskDto> {
    const todo = await this.prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) throw new NotFoundException(`Todo ${todoId} not found`);

    const { monitor, pullRequests, deployedEnvironments, ...subtaskData } = dto;
    const subtask = await this.prisma.subtask.create({
      data: {
        todoId,
        ...subtaskData,
      },
    });

    if (monitor) {
      await this.monitorsService.create(subtask.id, monitor, { silent: true });
    }

    await syncPullRequests(this.prisma, { subtaskId: subtask.id }, pullRequests);
    await syncDeployedEnvironments(
      this.prisma,
      { subtaskId: subtask.id },
      deployedEnvironments,
    );

    const full = await this.prisma.subtask.findUnique({
      where: { id: subtask.id },
      include: subtaskInclude,
    });

    const result = toSubtaskDto(full!);
    this.events.broadcast('subtask.created', result);
    return result;
  }

  async update(
    todoId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ): Promise<SubtaskDto> {
    await this.ensureExists(todoId, subtaskId);

    const { monitor, pullRequests, deployedEnvironments, ...subtaskData } = dto;

    await this.prisma.subtask.update({
      where: { id: subtaskId },
      data: subtaskData,
    });

    if (monitor) {
      if (monitor.type === MonitorType.DEPLOYMENT) {
        await this.monitorsService.upsertForSubtask(subtaskId, monitor, {
          silent: true,
        });
      } else {
        const existing = await this.prisma.monitor.findFirst({
          where: { subtaskId, envKey: monitor.type },
        });

        if (existing) {
          await this.monitorsService.update(existing.id, monitor, { silent: true });
        } else {
          if (!monitor.type || !monitor.cron || !monitor.config) {
            throw new BadRequestException(
              'Subtask has no monitor; provide type, cron, and config to create one',
            );
          }
          await this.monitorsService.create(subtaskId, {
            type: monitor.type,
            cron: monitor.cron,
            enabled: monitor.enabled,
            config: monitor.config,
          }, { silent: true });
        }
      }
    }

    await syncPullRequests(this.prisma, { subtaskId }, pullRequests);
    await syncDeployedEnvironments(this.prisma, { subtaskId }, deployedEnvironments);

    const subtask = await this.prisma.subtask.findUnique({
      where: { id: subtaskId },
      include: subtaskInclude,
    });

    const result = toSubtaskDto(subtask!);
    this.events.broadcast('subtask.updated', result);
    return result;
  }

  async remove(todoId: string, subtaskId: string): Promise<void> {
    await this.ensureExists(todoId, subtaskId);
    await this.prisma.subtask.delete({ where: { id: subtaskId } });
    this.events.broadcast('subtask.deleted', { id: subtaskId, todoId });
  }

  private async ensureExists(todoId: string, subtaskId: string): Promise<void> {
    const subtask = await this.prisma.subtask.findFirst({
      where: { id: subtaskId, todoId },
    });
    if (!subtask) {
      throw new NotFoundException(`Subtask ${subtaskId} not found for todo ${todoId}`);
    }
  }
}
