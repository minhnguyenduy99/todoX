import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationKind } from '@todo-platform/shared-types';
import { EventsGateway } from '../events/events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prisma = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const events = {
    broadcast: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
    prisma.notification.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: events },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('creates a notification and broadcasts notification.created', async () => {
    const createdAt = new Date('2026-07-27T10:00:00.000Z');
    prisma.notification.create.mockResolvedValue({
      id: 'n1',
      kind: NotificationKind.TODO_DEPLOYMENT,
      title: 'Deployment completed: Todo',
      body: 'dev #1 deployment completed.',
      payload: { todoId: 't1' },
      readAt: null,
      createdAt,
    });

    const dto = await service.create({
      kind: NotificationKind.TODO_DEPLOYMENT,
      title: 'Deployment completed: Todo',
      body: 'dev #1 deployment completed.',
      payload: { todoId: 't1' },
    });

    expect(dto.id).toBe('n1');
    expect(events.broadcast).toHaveBeenCalledWith('notification.created', dto);
  });

  it('purges expired rows when listing recent notifications', async () => {
    await service.findRecent();
    expect(prisma.notification.deleteMany).toHaveBeenCalled();
    expect(prisma.notification.findMany).toHaveBeenCalled();
  });

  it('throws when marking an unknown notification read', async () => {
    prisma.notification.findUnique.mockResolvedValue(null);
    await expect(service.markRead('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('broadcasts read-all updates', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });
    await service.markAllRead();
    expect(events.broadcast).toHaveBeenCalledWith('notification.updated', { readAll: true });
  });
});
