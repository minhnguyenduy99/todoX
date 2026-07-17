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

  it('POST /todos creates a todo with associated pull requests', async () => {
    const response = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Feature work',
        pullRequests: [
          {
            number: 42,
            title: 'Add feature X',
            status: 'open',
            url: 'https://github.com/org/repo/pull/42',
          },
        ],
      })
      .expect(201);

    expect(response.body.pullRequests).toHaveLength(1);
    expect(response.body.pullRequests[0]).toMatchObject({
      number: 42,
      title: 'Add feature X',
      status: 'open',
      url: 'https://github.com/org/repo/pull/42',
    });
  });

  it('PATCH /todos/:id replaces associated pull requests', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'PR todo',
        pullRequests: [
          {
            number: 1,
            title: 'First PR',
            status: 'open',
            url: 'https://github.com/org/repo/pull/1',
          },
        ],
      })
      .expect(201);

    const updateRes = await request(app.getHttpServer())
      .patch(`/todos/${createRes.body.id}`)
      .send({
        pullRequests: [
          {
            number: 2,
            title: 'Second PR',
            status: 'merged',
            url: 'https://github.com/org/repo/pull/2',
          },
        ],
      })
      .expect(200);

    expect(updateRes.body.pullRequests).toHaveLength(1);
    expect(updateRes.body.pullRequests[0].number).toBe(2);
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

  it('POST /todos/:todoId/subtasks creates a subtask with associated pull requests', async () => {
    const todoRes = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Todo with PR subtask' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/todos/${todoRes.body.id}/subtasks`)
      .send({
        name: 'Review PR',
        pullRequests: [
          {
            number: 99,
            title: 'Fix bug',
            status: 'open',
            url: 'https://github.com/org/repo/pull/99',
          },
        ],
      })
      .expect(201);

    expect(response.body.pullRequests).toHaveLength(1);
    expect(response.body.pullRequests[0].number).toBe(99);
  });

  it('POST /todos creates a todo with deployed environments', async () => {
    const response = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Deployed feature',
        deployedEnvironments: ['dev', 'uat'],
      })
      .expect(201);

    expect(response.body.deployedEnvironments).toHaveLength(2);
    expect(response.body.deployedEnvironments.map((env: { name: string }) => env.name)).toEqual([
      'dev',
      'uat',
    ]);
  });

  it('PATCH /todos/:id adds deployed environments without removing existing ones via merge', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Env todo',
        deployedEnvironments: ['dev'],
      })
      .expect(201);

    const updateRes = await request(app.getHttpServer())
      .patch(`/todos/${createRes.body.id}`)
      .send({
        deployedEnvironments: ['dev', 'uat', 'staging'],
      })
      .expect(200);

    expect(updateRes.body.deployedEnvironments).toHaveLength(3);
    expect(
      updateRes.body.deployedEnvironments.map((env: { name: string }) => env.name),
    ).toEqual(['dev', 'uat', 'staging']);
  });

  it('POST /todos/:todoId/subtasks creates a subtask with deployed environments', async () => {
    const todoRes = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Todo with env subtask' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/todos/${todoRes.body.id}/subtasks`)
      .send({
        name: 'Deploy to UAT',
        deployedEnvironments: ['uat-main'],
      })
      .expect(201);

    expect(response.body.deployedEnvironments).toHaveLength(1);
    expect(response.body.deployedEnvironments[0].name).toBe('uat-main');
  });
});
