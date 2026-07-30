import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TodosService } from './todos.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { MonitorsService } from '../monitors/monitors.service';
import { ReleasesService } from '../releases/releases.service';
import { TodoStatus } from '@todo-platform/shared-types';

describe('TodosService', () => {
  let service: TodosService;
  let prisma: {
    todo: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    associatedPullRequest: {
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    deployedEnvironment: {
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    testcaseScan: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let events: { broadcast: jest.Mock };
  let monitorsService: {
    createForTodo: jest.Mock;
    upsertForTodo: jest.Mock;
    update: jest.Mock;
  };
  let releasesService: {
    recomputeReleasesForTodo: jest.Mock;
  };

  const mockTodo = {
    id: 'todo-1',
    title: 'Test Todo',
    description: 'Description',
    status: 'NOT_STARTED',
    statusUpdateDate: new Date('2025-01-01'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    monitor: null,
    monitors: [],
    subtasks: [],
    pullRequests: [],
    deployedEnvironments: [],
  };

  beforeEach(async () => {
    prisma = {
      todo: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      associatedPullRequest: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      deployedEnvironment: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      testcaseScan: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    events = { broadcast: jest.fn() };
    monitorsService = {
      createForTodo: jest.fn(),
      upsertForTodo: jest.fn(),
      update: jest.fn(),
    };
    releasesService = {
      recomputeReleasesForTodo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: events },
        { provide: MonitorsService, useValue: monitorsService },
        { provide: ReleasesService, useValue: releasesService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(TodosService);
  });

  it('should list all todos', async () => {
    prisma.todo.findMany.mockResolvedValue([mockTodo]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Todo');
  });

  it('should create a todo and broadcast event', async () => {
    prisma.todo.create.mockResolvedValue(mockTodo);
    prisma.todo.findUnique.mockResolvedValue(mockTodo);
    const result = await service.create({ title: 'Test Todo', description: 'Description' });
    expect(result.id).toBe('todo-1');
    expect(events.broadcast).toHaveBeenCalledWith('todo.created', expect.any(Object));
  });

  it('should throw NotFoundException when todo not found', async () => {
    prisma.todo.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should update a todo', async () => {
    const updatedTodo = { ...mockTodo, status: 'COMPLETED' };
    prisma.todo.findUnique
      .mockResolvedValueOnce(mockTodo)
      .mockResolvedValueOnce(mockTodo)
      .mockResolvedValueOnce(updatedTodo);
    prisma.todo.update.mockResolvedValue(updatedTodo);
    const result = await service.update('todo-1', { status: TodoStatus.COMPLETED });
    expect(result.status).toBe(TodoStatus.COMPLETED);
    expect(events.broadcast).toHaveBeenCalledWith('todo.updated', expect.any(Object));
    expect(releasesService.recomputeReleasesForTodo).toHaveBeenCalledWith('todo-1');
  });
});
