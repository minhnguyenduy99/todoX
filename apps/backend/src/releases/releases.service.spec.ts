import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReleaseType, TodoStatus } from '@todo-platform/shared-types';
import { EventsGateway } from '../events/events.gateway';
import { MonitorsService } from '../monitors/monitors.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReleasesService } from './releases.service';

describe('ReleasesService', () => {
  let service: ReleasesService;
  let prisma: {
    release: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    releaseMember: {
      createMany: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
    releaseDeployment: {
      create: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    todo: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    service: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let events: { broadcast: jest.Mock };
  let monitorsService: {
    createForReleaseDeployment: jest.Mock;
  };

  const serviceA = {
    id: 'svc-a',
    keyName: 'service-a',
    displayName: 'Service A',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const todoA = {
    id: 'todo-a',
    title: 'Todo A',
    description: null,
    status: 'WAIT_FOR_STAGING',
    serviceId: 'svc-a',
    currentReleaseId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    service: serviceA,
    releaseMemberships: [],
  };

  const todoB = {
    ...todoA,
    id: 'todo-b',
    title: 'Todo B',
  };

  const baseRelease = {
    id: 'rel-1',
    releaseDate: '2026-07-20',
    content: 'Release notes',
    type: 'staging',
    status: 'not_started',
    createdAt: new Date('2026-07-20'),
    updatedAt: new Date('2026-07-20'),
    members: [
      { todoId: 'todo-a', todo: todoA },
      { todoId: 'todo-b', todo: todoB },
    ],
    deployments: [],
    completedTodos: [],
  };

  beforeEach(async () => {
    prisma = {
      release: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      releaseMember: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      releaseDeployment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      todo: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      service: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    events = { broadcast: jest.fn() };
    monitorsService = {
      createForReleaseDeployment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReleasesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: events },
        { provide: MonitorsService, useValue: monitorsService },
      ],
    }).compile();

    service = module.get(ReleasesService);
  });

  it('creates a staging release with eligible todos as not_started', async () => {
    prisma.todo.findMany
      .mockResolvedValueOnce([todoA, todoB])
      .mockResolvedValueOnce([todoA, todoB]);
    prisma.release.create.mockResolvedValue({ id: 'rel-1' });
    prisma.release.findUniqueOrThrow.mockResolvedValue(baseRelease);
    prisma.release.findUnique.mockResolvedValue(baseRelease);

    const result = await service.create({
      type: ReleaseType.STAGING,
      releaseDate: '2026-07-20',
      content: 'Release notes',
      todoIds: ['todo-a', 'todo-b'],
    });

    expect(result.status).toBe('not_started');
    expect(result.members).toHaveLength(2);
    expect(prisma.releaseMember.createMany).toHaveBeenCalled();
    expect(prisma.todo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentReleaseId: 'rel-1' },
      }),
    );
    expect(events.broadcast).toHaveBeenCalledWith('release.created', expect.any(Object));
  });

  it('rejects empty todoIds', async () => {
    await expect(
      service.create({
        type: ReleaseType.STAGING,
        releaseDate: '2026-07-20',
        content: 'x',
        todoIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects todos without a service', async () => {
    prisma.todo.findMany.mockResolvedValue([
      { ...todoA, serviceId: null, service: null, releaseMemberships: [] },
    ]);

    await expect(
      service.create({
        type: ReleaseType.STAGING,
        releaseDate: '2026-07-20',
        content: 'x',
        todoIds: ['todo-a'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects IN_PROGRESS todos for staging create', async () => {
    prisma.todo.findMany.mockResolvedValue([
      { ...todoA, status: 'IN_PROGRESS', releaseMemberships: [] },
    ]);

    await expect(
      service.create({
        type: ReleaseType.STAGING,
        releaseDate: '2026-07-20',
        content: 'x',
        todoIds: ['todo-a'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects todos already on a non-terminal release', async () => {
    prisma.todo.findMany.mockResolvedValue([
      {
        ...todoA,
        releaseMemberships: [
          {
            releaseId: 'rel-other',
            release: { id: 'rel-other', status: 'in_progress' },
          },
        ],
      },
    ]);

    await expect(
      service.create({
        type: ReleaseType.STAGING,
        releaseDate: '2026-07-20',
        content: 'x',
        todoIds: ['todo-a'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('appends a todo while not_started', async () => {
    const todoC = { ...todoA, id: 'todo-c', title: 'Todo C', releaseMemberships: [] };
    const withC = {
      ...baseRelease,
      members: [
        ...baseRelease.members,
        { todoId: 'todo-c', todo: todoC },
      ],
    };
    prisma.release.findUnique
      .mockResolvedValueOnce(baseRelease)
      .mockResolvedValueOnce(withC);
    prisma.todo.findMany
      .mockResolvedValueOnce([todoC])
      .mockResolvedValueOnce([todoC]);
    prisma.release.findUniqueOrThrow.mockResolvedValue(withC);

    const result = await service.update('rel-1', { todoIdsToAdd: ['todo-c'] });
    expect(result.members).toHaveLength(3);
    expect(prisma.releaseMember.createMany).toHaveBeenCalled();
  });

  it('rejects membership changes after in_progress', async () => {
    prisma.release.findUnique.mockResolvedValue({
      ...baseRelease,
      status: 'in_progress',
    });

    await expect(
      service.update('rel-1', { todoIdsToAdd: ['todo-c'] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('removes a member and cancels draft while not_started', async () => {
    const afterRemove = {
      ...baseRelease,
      members: [baseRelease.members[0]],
    };
    prisma.release.findUnique
      .mockResolvedValueOnce(baseRelease)
      .mockResolvedValueOnce(afterRemove)
      .mockResolvedValueOnce(baseRelease);
    prisma.release.findUniqueOrThrow.mockResolvedValue(afterRemove);
    prisma.todo.findMany.mockResolvedValue([todoB]);

    await service.update('rel-1', { todoIdsToRemove: ['todo-b'] });
    expect(prisma.releaseMember.deleteMany).toHaveBeenCalled();

    prisma.todo.findMany.mockResolvedValue([todoA, todoB]);
    await service.cancel('rel-1');
    expect(prisma.release.delete).toHaveBeenCalledWith({ where: { id: 'rel-1' } });
  });

  it('allows a todo on a terminal staging release to join a new prod release', async () => {
    const completedTodo = {
      ...todoA,
      status: TodoStatus.COMPLETED,
      releaseMemberships: [
        {
          releaseId: 'rel-staging',
          release: { id: 'rel-staging', status: 'successful' },
        },
      ],
    };
    prisma.todo.findMany
      .mockResolvedValueOnce([completedTodo])
      .mockResolvedValueOnce([completedTodo]);
    prisma.release.create.mockResolvedValue({ id: 'rel-prod' });
    const prodRelease = {
      ...baseRelease,
      id: 'rel-prod',
      type: 'prod',
      members: [{ todoId: 'todo-a', todo: completedTodo }],
    };
    prisma.release.findUniqueOrThrow.mockResolvedValue(prodRelease);
    prisma.release.findUnique.mockResolvedValue(prodRelease);

    const result = await service.create({
      type: ReleaseType.PROD,
      releaseDate: '2026-07-21',
      content: 'Prod notes',
      todoIds: ['todo-a'],
    });

    expect(result.type).toBe('prod');
    expect(prisma.todo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentReleaseId: 'rel-prod' },
      }),
    );
  });

  it('throws NotFoundException for missing release', async () => {
    prisma.release.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
