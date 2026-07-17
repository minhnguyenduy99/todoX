import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';

describe('Todos API (integration)', () => {
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
    await prisma.monitor.deleteMany();
    await prisma.subtask.deleteMany();
    await prisma.todo.deleteMany();
  });

  it('POST /todos creates a todo', async () => {
    const response = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Integration Test', description: 'Test description' })
      .expect(201);

    expect(response.body.title).toBe('Integration Test');
    expect(response.body.id).toBeDefined();
  });

  it('GET /todos lists todos', async () => {
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Todo 1' });

    const response = await request(app.getHttpServer()).get('/todos').expect(200);
    expect(response.body).toHaveLength(1);
  });

  it('GET /health returns health status', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('services');
  });

  it('POST /todos/:todoId/subtasks creates a subtask with an optional monitor', async () => {
    const todoRes = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Todo with subtask' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/todos/${todoRes.body.id}/subtasks`)
      .send({
        name: 'Wait for deployment',
        monitor: {
          type: 'http',
          cron: '*/5 * * * *',
          config: { url: 'https://example.com', expectedStatus: 200 },
        },
      })
      .expect(201);

    expect(response.body.name).toBe('Wait for deployment');
    expect(response.body.monitor).toMatchObject({
      type: 'http',
      cron: '*/5 * * * *',
      enabled: true,
    });
  });
});
