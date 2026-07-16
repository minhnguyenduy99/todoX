import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { toSubtaskDto } from '../common/mappers';
import type {
  CreateSubtaskDto,
  SubtaskDto,
  UpdateSubtaskDto,
} from '@todo-platform/shared-types';

@Injectable()
export class SubtasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async create(todoId: string, dto: CreateSubtaskDto): Promise<SubtaskDto> {
    const todo = await this.prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) throw new NotFoundException(`Todo ${todoId} not found`);

    const subtask = await this.prisma.subtask.create({
      data: {
        todoId,
        name: dto.name,
        status: dto.status,
      },
      include: { monitor: true },
    });

    const result = toSubtaskDto(subtask);
    this.events.broadcast('subtask.created', result);
    return result;
  }

  async update(
    todoId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ): Promise<SubtaskDto> {
    await this.ensureExists(todoId, subtaskId);

    const subtask = await this.prisma.subtask.update({
      where: { id: subtaskId },
      data: dto,
      include: { monitor: true },
    });

    const result = toSubtaskDto(subtask);
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
