import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { MonitorsService } from '../monitors/monitors.service';
import { syncPullRequests } from '../common/pull-requests';
import { syncDeployedEnvironments } from '../common/deployed-environments';
import { syncAssociatedTickets } from '../common/sync-associated-tickets';
import { syncTestcaseScans } from '../common/sync-testcase-scans';
import {
  applyTodoServiceResolution,
  resolveTodoServiceInput,
} from '../common/resolve-todo-service';
import { toTodoDto } from '../common/mappers';
import type { CreateTodoDto, TodoDto, UpdateTodoDto } from '@todo-platform/shared-types';
import type { ListTodosQuery } from '../common/release.dto';
import { NON_TERMINAL_RELEASE_STATUSES } from '../common/release-constants';
import { ReleasesService } from '../releases/releases.service';

const pullRequestInclude = {
  orderBy: { number: 'asc' as const },
};

const associatedTicketInclude = {
  orderBy: { createdAt: 'asc' as const },
};

const deployedEnvironmentInclude = {
  orderBy: { name: 'asc' as const },
};

const testcaseScanInclude = {
  orderBy: { createdAt: 'desc' as const },
};

const subtaskInclude = {
  include: {
    monitors: true,
    pullRequests: pullRequestInclude,
    deployedEnvironments: deployedEnvironmentInclude,
  },
  orderBy: { createdAt: 'asc' as const },
};

const todoInclude = {
  monitors: true,
  service: true,
  subtasks: subtaskInclude,
  pullRequests: pullRequestInclude,
  associatedTickets: associatedTicketInclude,
  deployedEnvironments: deployedEnvironmentInclude,
  testcaseScans: testcaseScanInclude,
};

@Injectable()
export class TodosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly monitorsService: MonitorsService,
    private readonly releasesService: ReleasesService,
  ) {}

  async findAll(filters?: ListTodosQuery): Promise<TodoDto[]> {
    const where: Prisma.TodoWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.serviceId) {
      where.serviceId = filters.serviceId;
    } else if (filters?.serviceKeyName) {
      where.service = { keyName: filters.serviceKeyName };
    }

    if (filters?.availableForRelease === true) {
      where.NOT = {
        releaseMemberships: {
          some: {
            release: {
              status: { in: [...NON_TERMINAL_RELEASE_STATUSES] },
            },
          },
        },
      };
    }

    const todos = await this.prisma.todo.findMany({
      where,
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
    const {
      monitor,
      pullRequests,
      deployedEnvironments,
      associatedTickets,
      testcaseScanHistory,
      serviceId,
      serviceKeyName,
      ...todoData
    } = dto;

    const serviceResolution = await resolveTodoServiceInput(this.prisma, {
      serviceId,
      serviceKeyName,
    });

    const createData: Prisma.TodoCreateInput = { ...todoData };
    if (serviceResolution.action === 'connect') {
      createData.service = { connect: { id: serviceResolution.serviceId } };
    }

    const todo = await this.prisma.todo.create({
      data: createData,
    });

    if (monitor) {
      await this.monitorsService.createForTodo(todo.id, monitor, { silent: true });
    }

    await syncPullRequests(this.prisma, { todoId: todo.id }, pullRequests);
    await syncAssociatedTickets(this.prisma, todo.id, associatedTickets);
    await syncTestcaseScans(
      this.prisma,
      this.monitorsService,
      todo.id,
      testcaseScanHistory,
      { silent: true },
    );
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
    const previous = await this.prisma.todo.findUnique({ where: { id } });
    const {
      monitor,
      pullRequests,
      deployedEnvironments,
      associatedTickets,
      testcaseScanHistory,
      serviceId,
      serviceKeyName,
      ...todoData
    } = dto;

    const serviceResolution = await resolveTodoServiceInput(this.prisma, {
      serviceId,
      serviceKeyName,
    });
    const serviceData = applyTodoServiceResolution(serviceResolution);

    await this.prisma.todo.update({
      where: { id },
      data: {
        ...todoData,
        ...(serviceData ?? {}),
      },
    });

    if (monitor) {
      await this.monitorsService.upsertForTodo(id, monitor, { silent: true });
    }

    await syncPullRequests(this.prisma, { todoId: id }, pullRequests);
    await syncAssociatedTickets(this.prisma, id, associatedTickets);
    await syncTestcaseScans(
      this.prisma,
      this.monitorsService,
      id,
      testcaseScanHistory,
      { silent: true },
    );
    await syncDeployedEnvironments(this.prisma, { todoId: id }, deployedEnvironments);

    const todo = await this.prisma.todo.findUnique({
      where: { id },
      include: todoInclude,
    });

    const result = toTodoDto(todo!);
    this.events.broadcast('todo.updated', result);

    if (dto.status !== undefined && dto.status !== previous?.status) {
      await this.releasesService.recomputeReleasesForTodo(id);
    }

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
