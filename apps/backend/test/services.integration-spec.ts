import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';

describe('Services API (integration)', () => {
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
    await prisma.service.deleteMany();
  });

  it('POST /services creates a service with displayName defaulting to keyName', async () => {
    const response = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'billing-api' })
      .expect(201);

    expect(response.body).toMatchObject({
      keyName: 'billing-api',
      displayName: 'billing-api',
    });
    expect(response.body.id).toBeDefined();
  });

  it('POST /services accepts optional displayName', async () => {
    const response = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'auth', displayName: 'Authentication' })
      .expect(201);

    expect(response.body.displayName).toBe('Authentication');
  });

  it('POST /services rejects duplicate keyName', async () => {
    await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'billing-api' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'billing-api' })
      .expect(409);
  });

  it('POST /services rejects invalid keyName characters', async () => {
    await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'Billing API' })
      .expect(400);
  });

  it('GET /services lists services', async () => {
    await request(app.getHttpServer()).post('/services').send({ keyName: 'alpha' });
    await request(app.getHttpServer()).post('/services').send({ keyName: 'beta' });

    const response = await request(app.getHttpServer()).get('/services').expect(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((s: { keyName: string }) => s.keyName)).toEqual(['alpha', 'beta']);
  });

  it('PATCH /services/:id updates displayName only', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'billing-api' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/services/${createRes.body.id}`)
      .send({ displayName: 'Billing API' })
      .expect(200);

    expect(response.body).toMatchObject({
      keyName: 'billing-api',
      displayName: 'Billing API',
    });
  });

  it('PATCH /services/:id rejects keyName in body', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'billing-api' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/services/${createRes.body.id}`)
      .send({ keyName: 'renamed' })
      .expect(400);
  });

  it('DELETE /services/:id succeeds when todos reference it (SET NULL)', async () => {
    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'billing-api' })
      .expect(201);

    const todoRes = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Bill work', serviceKeyName: 'billing-api' })
      .expect(201);

    await request(app.getHttpServer()).delete(`/services/${serviceRes.body.id}`).expect(200);

    const todo = await request(app.getHttpServer()).get(`/todos/${todoRes.body.id}`).expect(200);
    expect(todo.body.service).toBeNull();
  });

  it('GET /services/:id returns 404 for unknown id', async () => {
    await request(app.getHttpServer())
      .get('/services/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});
