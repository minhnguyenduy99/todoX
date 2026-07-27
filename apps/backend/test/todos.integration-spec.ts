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
    await prisma.testcaseScan.deleteMany();
    await prisma.subtask.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.service.deleteMany();
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

  it('POST /todos creates a todo with associated external tickets', async () => {
    const response = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Bug fix work',
        associatedTickets: [
          {
            title: 'PROJ-42: Login redirect fails',
            type: 'bug',
            link: 'https://jira.example.com/browse/PROJ-42',
          },
          {
            title: 'PROJ-43: Add SSO',
            type: 'feature',
            link: 'https://jira.example.com/browse/PROJ-43',
          },
        ],
      })
      .expect(201);

    expect(response.body.associatedTickets).toHaveLength(2);
    expect(response.body.associatedTickets[0]).toMatchObject({
      title: 'PROJ-42: Login redirect fails',
      type: 'bug',
      link: 'https://jira.example.com/browse/PROJ-42',
    });
    expect(response.body.associatedTickets[1]).toMatchObject({
      title: 'PROJ-43: Add SSO',
      type: 'feature',
      link: 'https://jira.example.com/browse/PROJ-43',
    });
  });

  it('PATCH /todos/:id replaces associated external tickets', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Ticket todo',
        associatedTickets: [
          {
            title: 'OLD-1',
            type: 'bug',
            link: 'https://jira.example.com/browse/OLD-1',
          },
        ],
      })
      .expect(201);

    const updateRes = await request(app.getHttpServer())
      .patch(`/todos/${createRes.body.id}`)
      .send({
        associatedTickets: [
          {
            title: 'NEW-2: Feature rollout',
            type: 'feature',
            link: 'https://jira.example.com/browse/NEW-2',
          },
        ],
      })
      .expect(200);

    expect(updateRes.body.associatedTickets).toHaveLength(1);
    expect(updateRes.body.associatedTickets[0]).toMatchObject({
      title: 'NEW-2: Feature rollout',
      type: 'feature',
      link: 'https://jira.example.com/browse/NEW-2',
    });
  });

  it('PATCH /todos/:id clears associated external tickets', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Clear ticket todo',
        associatedTickets: [
          {
            title: 'TEMP-1',
            type: 'bug',
            link: 'https://jira.example.com/browse/TEMP-1',
          },
        ],
      })
      .expect(201);

    const updateRes = await request(app.getHttpServer())
      .patch(`/todos/${createRes.body.id}`)
      .send({ associatedTickets: [] })
      .expect(200);

    expect(updateRes.body.associatedTickets).toHaveLength(0);
  });

  it('PATCH /todos/:id leaves associated tickets unchanged when omitted', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Keep ticket todo',
        associatedTickets: [
          {
            title: 'KEEP-1',
            type: 'feature',
            link: 'https://jira.example.com/browse/KEEP-1',
          },
        ],
      })
      .expect(201);

    const updateRes = await request(app.getHttpServer())
      .patch(`/todos/${createRes.body.id}`)
      .send({ title: 'Renamed todo' })
      .expect(200);

    expect(updateRes.body.title).toBe('Renamed todo');
    expect(updateRes.body.associatedTickets).toHaveLength(1);
    expect(updateRes.body.associatedTickets[0]).toMatchObject({
      title: 'KEEP-1',
      type: 'feature',
      link: 'https://jira.example.com/browse/KEEP-1',
    });
  });

  it('POST /todos rejects an associated ticket with an invalid link', async () => {
    await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Invalid ticket',
        associatedTickets: [
          {
            title: 'BAD-1',
            type: 'bug',
            link: 'not-a-url',
          },
        ],
      })
      .expect(400);
  });

  it('POST /todos rejects an associated ticket with an invalid type', async () => {
    await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Invalid type',
        associatedTickets: [
          {
            title: 'BAD-2',
            type: 'chore',
            link: 'https://jira.example.com/browse/BAD-2',
          },
        ],
      })
      .expect(400);
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

  it('POST /todos/:todoId/subtasks creates a subtask with a deployment monitor', async () => {
    const todoRes = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Deploy todo' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/todos/${todoRes.body.id}/subtasks`)
      .send({
        name: 'Deploy to dev',
        deployedEnvironments: ['dev'],
        monitor: {
          type: 'deployment',
          cron: '*/5 * * * *',
          config: {
            env: 'dev',
            jobUrl: 'https://jenkins.example.net/job/my-job',
            buildNumber: 100,
          },
        },
      })
      .expect(201);

    expect(response.body.monitor).toMatchObject({
      type: 'deployment',
      cron: '*/5 * * * *',
      config: {
        env: 'dev',
        jobUrl: 'https://jenkins.example.net/job/my-job',
        buildNumber: 100,
      },
    });
  });

  it('POST /todos creates a todo with a deployment monitor', async () => {
    const response = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Deploy todo with monitor',
        deployedEnvironments: ['dev'],
        monitor: {
          type: 'deployment',
          cron: '*/5 * * * *',
          config: {
            env: 'dev',
            jobUrl: 'https://jenkins.example.net/job/my-job',
            buildNumber: 200,
          },
        },
      })
      .expect(201);

    expect(response.body.monitor).toMatchObject({
      type: 'deployment',
      todoId: response.body.id,
      subtaskId: null,
    });
  });

  it('POST /todos/:todoId/monitors creates a monitor for a todo', async () => {
    const todoRes = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Todo for monitor endpoint' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/todos/${todoRes.body.id}/monitors`)
      .send({
        type: 'deployment',
        cron: '*/5 * * * *',
        config: {
          env: 'uat',
          jobUrl: 'https://jenkins.example.net/job/uat-job',
          buildNumber: 50,
        },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      type: 'deployment',
      todoId: todoRes.body.id,
      subtaskId: null,
    });

    await request(app.getHttpServer())
      .post(`/todos/${todoRes.body.id}/monitors`)
      .send({
        type: 'deployment',
        cron: '*/5 * * * *',
        config: { env: 'uat', jobUrl: 'https://jenkins.example.net/job/uat-job', buildNumber: 51 },
      })
      .expect(201);

    const monitors = await prisma.monitor.findMany({
      where: { todoId: todoRes.body.id },
    });
    expect(monitors).toHaveLength(1);
    expect((monitors[0]?.config as { buildNumber: number }).buildNumber).toBe(51);
  });

  it('PATCH /todos/:id keeps dev monitor when adding uat monitor', async () => {
    const todoRes = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Multi-env deploy todo',
        deployedEnvironments: ['dev', 'uat'],
        monitor: {
          type: 'deployment',
          cron: '*/5 * * * *',
          config: {
            env: 'dev',
            jobUrl: 'https://jenkins.example.net/job/dev-job',
            buildNumber: 10,
          },
        },
      })
      .expect(201);

    const updateRes = await request(app.getHttpServer())
      .patch(`/todos/${todoRes.body.id}`)
      .send({
        monitor: {
          type: 'deployment',
          cron: '*/5 * * * *',
          config: {
            env: 'uat',
            jobUrl: 'https://jenkins.example.net/job/uat-job',
            buildNumber: 20,
          },
        },
      })
      .expect(200);

    expect(updateRes.body.monitors).toHaveLength(2);
    expect(updateRes.body.monitors.map((m: { config: { env: string } }) => m.config.env).sort()).toEqual([
      'dev',
      'uat',
    ]);

    const monitors = await prisma.monitor.findMany({
      where: { todoId: todoRes.body.id },
      orderBy: { envKey: 'asc' },
    });
    expect(monitors).toHaveLength(2);
    expect(monitors.map((m) => m.envKey)).toEqual(['dev', 'uat']);
  });

  it('PATCH /todos/:id adds a deployment monitor to an existing todo', async () => {
    const todoRes = await request(app.getHttpServer())
      .post('/todos')
      .send({
        title: 'Todo to add monitor',
        deployedEnvironments: ['staging'],
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/todos/${todoRes.body.id}`)
      .send({
        monitor: {
          type: 'deployment',
          cron: '*/10 * * * *',
          config: {
            env: 'staging',
            jobUrl: 'https://jenkins.example.net/job/staging-job',
            buildNumber: 10,
          },
        },
      })
      .expect(200);

    expect(response.body.monitor).toMatchObject({
      type: 'deployment',
      cron: '*/10 * * * *',
      todoId: todoRes.body.id,
      subtaskId: null,
    });
  });

  describe('service association', () => {
    it('POST /todos assigns service by serviceKeyName', async () => {
      await request(app.getHttpServer())
        .post('/services')
        .send({ keyName: 'billing-api', displayName: 'Billing API' });

      const response = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Bill work', serviceKeyName: 'billing-api' })
        .expect(201);

      expect(response.body.service).toMatchObject({
        keyName: 'billing-api',
        displayName: 'Billing API',
      });
    });

    it('POST /todos assigns service by serviceId', async () => {
      const serviceRes = await request(app.getHttpServer())
        .post('/services')
        .send({ keyName: 'auth' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Auth work', serviceId: serviceRes.body.id })
        .expect(201);

      expect(response.body.service?.keyName).toBe('auth');
    });

    it('PATCH /todos/:id clears service with explicit null', async () => {
      await request(app.getHttpServer()).post('/services').send({ keyName: 'billing-api' });
      const createRes = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Bill work', serviceKeyName: 'billing-api' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/todos/${createRes.body.id}`)
        .send({ serviceKeyName: null })
        .expect(200);

      expect(response.body.service).toBeNull();
    });

    it('PATCH /todos/:id null serviceId ignores serviceKeyName (R8)', async () => {
      await request(app.getHttpServer()).post('/services').send({ keyName: 'billing-api' });
      const createRes = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Bill work', serviceKeyName: 'billing-api' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/todos/${createRes.body.id}`)
        .send({ serviceId: null, serviceKeyName: 'billing-api' })
        .expect(200);

      expect(response.body.service).toBeNull();
    });

    it('PATCH /todos/:id rejects unknown serviceKeyName', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Work' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/todos/${createRes.body.id}`)
        .send({ serviceKeyName: 'missing' })
        .expect(400);
    });

    it('PATCH /todos/:id rejects conflicting serviceId and serviceKeyName', async () => {
      await request(app.getHttpServer()).post('/services').send({ keyName: 'alpha' });
      const beta = await request(app.getHttpServer())
        .post('/services')
        .send({ keyName: 'beta' })
        .expect(201);

      const createRes = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Work' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/todos/${createRes.body.id}`)
        .send({ serviceId: beta.body.id, serviceKeyName: 'alpha' })
        .expect(400);
    });
  });

  describe('testcase scan history', () => {
    it('POST /todos/:id/testcase-scans creates scan without monitor when no jobUrl', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Scan todo' })
        .expect(201);

      const scanRes = await request(app.getHttpServer())
        .post(`/todos/${createRes.body.id}/testcase-scans`)
        .send({ name: 'Manual scan', status: 'completed' })
        .expect(201);

      expect(scanRes.body.name).toBe('Manual scan');
      expect(scanRes.body.status).toBe('completed');

      const monitors = await prisma.monitor.findMany();
      expect(monitors).toHaveLength(0);
    });

    it('POST /todos/:id/testcase-scans creates scan with monitor when jobUrl provided', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Scan todo' })
        .expect(201);

      const scanRes = await request(app.getHttpServer())
        .post(`/todos/${createRes.body.id}/testcase-scans`)
        .send({
          name: 'Regression',
          jobUrl: 'https://jenkins-scan.example.net/job/test-scan/42',
        })
        .expect(201);

      expect(scanRes.body.status).toBe('scanning');

      const monitor = await prisma.monitor.findFirst({
        where: { testcaseScanId: scanRes.body.id },
      });
      expect(monitor).toBeTruthy();
      expect(monitor?.type).toBe('testcase_scan');

      const todoRes = await request(app.getHttpServer())
        .get(`/todos/${createRes.body.id}`)
        .expect(200);
      expect(todoRes.body.testcaseScanHistory).toHaveLength(1);
    });

    it('DELETE /todos/:id/testcase-scans/:scanId removes scan and monitor', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/todos')
        .send({ title: 'Scan todo' })
        .expect(201);

      const scanRes = await request(app.getHttpServer())
        .post(`/todos/${createRes.body.id}/testcase-scans`)
        .send({
          name: 'Regression',
          jobUrl: 'https://jenkins-scan.example.net/job/test-scan/42',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/todos/${createRes.body.id}/testcase-scans/${scanRes.body.id}`)
        .expect(200);

      const monitor = await prisma.monitor.findFirst({
        where: { testcaseScanId: scanRes.body.id },
      });
      expect(monitor).toBeNull();
    });
  });
});
