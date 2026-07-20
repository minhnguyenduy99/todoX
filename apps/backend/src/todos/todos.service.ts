import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { MonitorsService } from '../monitors/monitors.service';
import { syncPullRequests } from '../common/pull-requests';
import { syncDeployedEnvironments } from '../common/deployed-environments';
import { toTodoDto } from '../common/mappers';
import type { CreateTodoDto, TodoDto, UpdateTodoDto } from '@todo-platform/shared-types';

const pullRequestInclude = {
  orderBy: { number: 'asc' as const },
};

const deployedEnvironmentInclude = {
  orderBy: { name: 'asc' as const },
};

const subtaskInclude = {
  include: {
    monitor: true,
    pullRequests: pullRequestInclude,
    deployedEnvironments: deployedEnvironmentInclude,
  },
  orderBy: { createdAt: 'asc' as const },
};

const todoInclude = {
  monitor: true,
  subtasks: subtaskInclude,
  pullRequests: pullRequestInclude,
  deployedEnvironments: deployedEnvironmentInclude,
};

@Injectable()
export class TodosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly monitorsService: MonitorsService,
  ) {}

  async findAll(): Promise<TodoDto[]> {
    const todos = await this.prisma.todo.findMany({
      include: todoInclude,
      orderBy: { createdAt: 'desc' },
    });
    return todos.map(toTodoDto);
  }

  async findOne(id: string): Promise<TodoDto> {
    const todo = await this.prisma.todo.findUnique({
      where: { id },
      include: todoInclude,
    });
    if (!todo) throw new NotFoundException(`Todo ${id} not found`);
    return toTodoDto(todo);
  }

  async create(dto: CreateTodoDto): Promise<TodoDto> {
    const { monitor, pullRequests, deployedEnvironments, ...todoData } = dto;
    const todo = await this.prisma.todo.create({
      data: todoData,
    });

    if (monitor) {
      await this.monitorsService.createForTodo(todo.id, monitor, { silent: true });
    }

    await syncPullRequests(this.prisma, { todoId: todo.id }, pullRequests);
    await syncDeployedEnvironments(this.prisma, { todoId: todo.id }, deployedEnvironments);

    const full = await this.prisma.todo.findUnique({
      where: { id: todo.id },
      include: todoInclude,
    });

    const result = toTodoDto(full!);
    this.events.broadcast('todo.created', result);
    return result;
  }

  async update(id: string, dto: UpdateTodoDto): Promise<TodoDto> {
    await this.ensureExists(id);
    const { monitor, pullRequests, deployedEnvironments, ...todoData } = dto;

    await this.prisma.todo.update({
      where: { id },
      data: todoData,
    });

    if (monitor) {
      const existing = await this.prisma.monitor.findUnique({
        where: { todoId: id },
      });

      if (existing) {
        await this.monitorsService.update(existing.id, monitor, { silent: true });
      } else {
        if (!monitor.type || !monitor.cron || !monitor.config) {
          throw new BadRequestException(
            'Todo has no monitor; provide type, cron, and config to create one',
          );
        }
        await this.monitorsService.createForTodo(
          id,
          {
            type: monitor.type,
            cron: monitor.cron,
            enabled: monitor.enabled,
            config: monitor.config,
          },
          { silent: true },
        );
      }
    }

    await syncPullRequests(this.prisma, { todoId: id }, pullRequests);
    await syncDeployedEnvironments(this.prisma, { todoId: id }, deployedEnvironments);

    const todo = await this.prisma.todo.findUnique({
      where: { id },
      include: todoInclude,
    });

    const result = toTodoDto(todo!);
    this.events.broadcast('todo.updated', result);
    return result;
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.todo.delete({ where: { id } });
    this.events.broadcast('todo.deleted', { id });
  }

  private async ensureExists(id: string): Promise<void> {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) throw new NotFoundException(`Todo ${id} not found`);
  }
}
