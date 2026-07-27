import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { NotificationKind } from '@todo-platform/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';

describe('Notifications API (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SchedulerService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        scheduleMonitor: jest.fn(),
        unscheduleMonitor: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
  });

  it('GET /notifications returns persisted notifications', async () => {
    await prisma.notification.create({
      data: {
        kind: NotificationKind.TESTCASE_SCAN,
        title: 'Test scan completed: Regression',
        body: 'Scan finished.',
        payload: { scanId: 's1' },
      },
    });

    const response = await request(app.getHttpServer()).get('/notifications').expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].title).toContain('Test scan completed');
    expect(response.body[0].readAt).toBeNull();
  });

  it('POST /notifications/read-all marks unread notifications read', async () => {
    const row = await prisma.notification.create({
      data: {
        kind: NotificationKind.TODO_DEPLOYMENT,
        title: 'Deployment completed: Todo',
        body: 'Done.',
        payload: {},
      },
    });

    await request(app.getHttpServer()).post('/notifications/read-all').expect(204);

    const updated = await prisma.notification.findUnique({ where: { id: row.id } });
    expect(updated?.readAt).not.toBeNull();
  });

  it('PATCH /notifications/:id/read returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/00000000-0000-0000-0000-000000000000/read')
      .expect(404);
  });
});
