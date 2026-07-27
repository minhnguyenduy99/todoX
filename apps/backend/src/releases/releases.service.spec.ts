import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReleaseStatus, ReleaseType, TodoStatus } from '@todo-platform/shared-types';
import { EventsGateway } from '../events/events.gateway';
import { MonitorsService } from '../monitors/monitors.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReleasesService } from './releases.service';
import { ReleaseDeploymentDiscoveryService } from './release-deployment-discovery.service';

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
      updateMany: jest.Mock;
    };
    deployedEnvironment: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    monitor: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
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
    update: jest.Mock;
    createForTodo: jest.Mock;
    upsertForTodo: jest.Mock;
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
    changelog: null,
    status: 'WAIT_FOR_STAGING',
    serviceId: 'svc-a',
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
    status: 'in_progress',
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
        updateMany: jest.fn(),
      },
      deployedEnvironment: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      monitor: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
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
      update: jest.fn(),
      createForTodo: jest.fn(),
      upsertForTodo: jest.fn(),
    };
    const releaseDeploymentDiscovery = {
      maybeStartDiscoveryMonitor: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReleasesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: events },
        { provide: MonitorsService, useValue: monitorsService },
        {
          provide: ReleaseDeploymentDiscoveryService,
          useValue: releaseDeploymentDiscovery,
        },
        {
          provide: NotificationsService,
          useValue: {
            createForReleaseDeployment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ReleasesService);
  });

  it('creates a staging release with eligible todos as in_progress', async () => {
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

    expect(result.status).toBe('in_progress');
    expect(prisma.release.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'in_progress' }),
      }),
    );
    expect(result.members).toHaveLength(2);
    expect(prisma.releaseMember.createMany).toHaveBeenCalled();
    expect(events.broadcast).toHaveBeenCalledWith('release.created', expect.any(Object));
  });

  it('merges todo changelogs into release content on create', async () => {
    const todoWithChangelog = {
      ...todoA,
      changelog: 'Fixed rounding on refunds.',
    };
    prisma.todo.findMany
      .mockResolvedValueOnce([todoWithChangelog])
      .mockResolvedValueOnce([todoWithChangelog]);
    prisma.release.create.mockResolvedValue({ id: 'rel-1' });
    prisma.release.findUniqueOrThrow.mockResolvedValue({
      ...baseRelease,
      members: [{ todoId: 'todo-a', todo: todoWithChangelog }],
      content: 'March staging cut\n\n## Changelog by service\n\n### Service A\n- **Todo A** — Fixed rounding on refunds.',
    });
    prisma.release.findUnique.mockResolvedValue({
      ...baseRelease,
      members: [{ todoId: 'todo-a', todo: todoWithChangelog }],
    });

    await service.create({
      type: ReleaseType.STAGING,
      releaseDate: '2026-07-20',
      content: 'March staging cut',
      todoIds: ['todo-a'],
    });

    expect(prisma.release.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: expect.stringContaining('## Changelog by service'),
        }),
      }),
    );
    expect(prisma.release.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: expect.stringContaining('Fixed rounding on refunds.'),
        }),
      }),
    );
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

  it('appends a todo before deployments are attached', async () => {
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
    prisma.releaseMember.findMany.mockResolvedValue([
      { todo: todoA },
      { todo: todoB },
      { todo: todoC },
    ]);

    const result = await service.update('rel-1', { todoIdsToAdd: ['todo-c'] });
    expect(result.members).toHaveLength(3);
    expect(prisma.releaseMember.createMany).toHaveBeenCalled();
  });

  it('rejects membership changes after deployments are attached', async () => {
    prisma.release.findUnique.mockResolvedValue({
      ...baseRelease,
      deployments: [{ id: 'dep-1', serviceId: 'svc-a', status: 'pending' }],
    });

    await expect(
      service.update('rel-1', { todoIdsToAdd: ['todo-c'] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('removes a member and cancels draft before deployments', async () => {
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
    prisma.releaseMember.findMany.mockResolvedValue([{ todo: todoA }]);

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
    expect(prisma.releaseMember.createMany).toHaveBeenCalled();
  });

  it('throws NotFoundException for missing release', async () => {
    prisma.release.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('manual successful status completes all staging member todos', async () => {
    jest
      .spyOn(service, 'attachTodoDeploymentMonitorsForService')
      .mockResolvedValue(undefined);

    const completedMembers = [
      { todoId: 'todo-a', todo: { ...todoA, status: 'COMPLETED' } },
      { todoId: 'todo-b', todo: { ...todoB, status: 'COMPLETED' } },
    ];
    const successfulRelease = {
      ...baseRelease,
      status: 'successful',
      members: completedMembers,
    };

    prisma.release.findUnique
      .mockResolvedValueOnce(baseRelease)
      .mockResolvedValueOnce(baseRelease)
      .mockResolvedValueOnce(successfulRelease);
    prisma.releaseMember.findMany.mockResolvedValue([
      { todoId: 'todo-a', todo: todoA },
      { todoId: 'todo-b', todo: todoB },
    ]);
    prisma.releaseDeployment.findUnique.mockResolvedValue({
      jobUrl: 'https://jenkins/job/staging',
      buildNumber: 166,
      monitor: null,
    });
    prisma.todo.updateMany.mockResolvedValue({ count: 2 });
    prisma.todo.findMany.mockResolvedValue([
      { ...todoA, status: 'COMPLETED', monitor: null, subtasks: [], pullRequests: [], associatedTickets: [], deployedEnvironments: [] },
      { ...todoB, status: 'COMPLETED', monitor: null, subtasks: [], pullRequests: [], associatedTickets: [], deployedEnvironments: [] },
    ]);
    prisma.releaseDeployment.updateMany.mockResolvedValue({ count: 0 });
    prisma.release.update.mockResolvedValue(successfulRelease);

    const result = await service.update('rel-1', {
      status: ReleaseStatus.SUCCESSFUL,
    });

    expect(prisma.todo.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['todo-a', 'todo-b'] } },
      data: { status: 'COMPLETED' },
    });
    expect(prisma.release.update).toHaveBeenCalledWith({
      where: { id: 'rel-1' },
      data: { status: ReleaseStatus.SUCCESSFUL },
    });
    expect(result.status).toBe('successful');
  });

  it('completeStagingTodosForService attaches staging env when deployment succeeds', async () => {
    const attachSpy = jest
      .spyOn(service, 'attachTodoDeploymentMonitorsForService')
      .mockResolvedValue(undefined);

    prisma.releaseMember.findMany.mockResolvedValue([
      { todoId: 'todo-a', todo: todoA },
    ]);
    prisma.releaseDeployment.findUnique.mockResolvedValue({
      id: 'dep-1',
      releaseId: 'rel-1',
      serviceId: 'svc-a',
      jobUrl: 'https://jenkins/job/staging',
      buildNumber: 166,
      monitor: {
        lastResult: { status: 'success', message: 'ok' },
        lastRunAt: new Date('2026-07-24T08:35:00Z'),
      },
    });
    prisma.monitor.findFirst.mockResolvedValue({ id: 'mon-todo-a' });
    prisma.monitor.update.mockResolvedValue({});
    prisma.todo.updateMany.mockResolvedValue({ count: 1 });
    prisma.todo.findMany.mockResolvedValue([
      {
        ...todoA,
        status: 'COMPLETED',
        monitor: null,
        subtasks: [],
        pullRequests: [],
        associatedTickets: [],
        deployedEnvironments: [],
      },
    ]);

    await service.completeStagingTodosForService('rel-1', 'svc-a');

    expect(attachSpy).toHaveBeenCalledWith(
      'rel-1',
      'svc-a',
      'https://jenkins/job/staging',
      166,
    );
    expect(prisma.monitor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mon-todo-a' },
        data: expect.objectContaining({
          lastResult: { status: 'success', message: 'ok' },
        }),
      }),
    );
    expect(prisma.todo.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['todo-a'] } },
      data: { status: 'COMPLETED' },
    });
  });

  it('recomputes release status when member todos become COMPLETED', async () => {
    const membersCompleted = {
      ...baseRelease,
      status: 'in_progress',
      members: [
        { todoId: 'todo-a', todo: { ...todoA, status: 'COMPLETED' } },
        { todoId: 'todo-b', todo: { ...todoB, status: 'COMPLETED' } },
      ],
    };
    const afterAgg = { ...membersCompleted, status: 'successful' };

    prisma.releaseMember.findMany.mockResolvedValue([{ releaseId: 'rel-1' }]);
    prisma.release.findUnique.mockResolvedValue(membersCompleted);
    prisma.release.update.mockResolvedValue(afterAgg);

    await service.recomputeReleasesForTodo('todo-a');

    expect(prisma.release.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rel-1' },
        data: { status: ReleaseStatus.SUCCESSFUL },
      }),
    );
    expect(events.broadcast).toHaveBeenCalledWith(
      'release.updated',
      expect.objectContaining({ status: 'successful' }),
    );
  });
});
