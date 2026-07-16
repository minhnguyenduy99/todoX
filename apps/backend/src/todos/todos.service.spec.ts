import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TodosService } from './todos.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
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
  };
  let events: { broadcast: jest.Mock };

  const mockTodo = {
    id: 'todo-1',
    title: 'Test Todo',
    description: 'Description',
    status: 'TODO',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    subtasks: [],
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
    };
    events = { broadcast: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: events },
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
    const result = await service.create({ title: 'Test Todo', description: 'Description' });
    expect(result.id).toBe('todo-1');
    expect(events.broadcast).toHaveBeenCalledWith('todo.created', expect.any(Object));
  });

  it('should throw NotFoundException when todo not found', async () => {
    prisma.todo.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should update a todo', async () => {
    prisma.todo.findUnique.mockResolvedValue(mockTodo);
    prisma.todo.update.mockResolvedValue({ ...mockTodo, status: 'COMPLETED' });
    const result = await service.update('todo-1', { status: TodoStatus.COMPLETED });
    expect(result.status).toBe(TodoStatus.COMPLETED);
    expect(events.broadcast).toHaveBeenCalledWith('todo.updated', expect.any(Object));
  });
});
