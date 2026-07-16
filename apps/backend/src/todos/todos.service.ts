import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { toTodoDto } from '../common/mappers';
import type { CreateTodoDto, TodoDto, UpdateTodoDto } from '@todo-platform/shared-types';

const todoInclude = {
  subtasks: {
    include: { monitor: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class TodosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
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
    const todo = await this.prisma.todo.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
      },
      include: todoInclude,
    });
    const result = toTodoDto(todo);
    this.events.broadcast('todo.created', result);
    return result;
  }

  async update(id: string, dto: UpdateTodoDto): Promise<TodoDto> {
    await this.ensureExists(id);
    const todo = await this.prisma.todo.update({
      where: { id },
      data: dto,
      include: todoInclude,
    });
    const result = toTodoDto(todo);
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
