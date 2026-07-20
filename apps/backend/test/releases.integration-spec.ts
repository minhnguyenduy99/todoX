import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';

describe('Releases API (integration)', () => {
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
    await prisma.releaseDeployment.deleteMany();
    await prisma.releaseMember.deleteMany();
    await prisma.completedTodo.deleteMany();
    await prisma.release.deleteMany();
    await prisma.subtask.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.service.deleteMany();
  });

  async function seedEligibleTodos() {
    const service = await prisma.service.create({
      data: { keyName: 'billing-api', displayName: 'Billing' },
    });
    const todoA = await prisma.todo.create({
      data: {
        title: 'Todo A',
        status: 'WAIT_FOR_STAGING',
        serviceId: service.id,
      },
    });
    const todoB = await prisma.todo.create({
      data: {
        title: 'Todo B',
        status: 'WAIT_FOR_STAGING',
        serviceId: service.id,
      },
    });
    return { service, todoA, todoB };
  }

  it('POST /releases creates staging release and sets membership', async () => {
    const { todoA, todoB } = await seedEligibleTodos();

    const response = await request(app.getHttpServer())
      .post('/releases')
      .send({
        type: 'staging',
        releaseDate: '2026-07-20',
        content: 'Staging notes',
        todoIds: [todoA.id, todoB.id],
      })
      .expect(201);

    expect(response.body.status).toBe('not_started');
    expect(response.body.members).toHaveLength(2);

    const members = await prisma.releaseMember.findMany({
      where: { releaseId: response.body.id },
    });
    expect(members.map((m) => m.todoId).sort()).toEqual(
      [todoA.id, todoB.id].sort(),
    );
  });

  it('availableForRelease filter excludes members of non-terminal releases', async () => {
    const { todoA, todoB } = await seedEligibleTodos();

    await request(app.getHttpServer())
      .post('/releases')
      .send({
        type: 'staging',
        releaseDate: '2026-07-20',
        content: 'Staging notes',
        todoIds: [todoA.id],
      })
      .expect(201);

    const available = await request(app.getHttpServer())
      .get('/todos')
      .query({ availableForRelease: true, status: 'WAIT_FOR_STAGING' })
      .expect(200);

    const ids = available.body.map((t: { id: string }) => t.id);
    expect(ids).toContain(todoB.id);
    expect(ids).not.toContain(todoA.id);
  });

  it('rejects create when todo is already on in_progress release', async () => {
    const { todoA, todoB } = await seedEligibleTodos();

    const created = await request(app.getHttpServer())
      .post('/releases')
      .send({
        type: 'staging',
        releaseDate: '2026-07-20',
        content: 'Staging notes',
        todoIds: [todoA.id],
      })
      .expect(201);

    await prisma.release.update({
      where: { id: created.body.id },
      data: { status: 'in_progress' },
    });

    await request(app.getHttpServer())
      .post('/releases')
      .send({
        type: 'staging',
        releaseDate: '2026-07-21',
        content: 'Other',
        todoIds: [todoA.id, todoB.id],
      })
      .expect(409);
  });
});
