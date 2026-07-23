import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { JenkinsJobValidationService } from '../src/jenkins/jenkins-job-validation.service';

describe('Service Deployments API (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jenkinsValidation: { validateJobUrl: jest.Mock };
  const originalFetch = global.fetch;

  beforeAll(async () => {
    jenkinsValidation = {
      validateJobUrl: jest.fn(),
    };

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
      .overrideProvider(JenkinsJobValidationService)
      .useValue(jenkinsValidation)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
  });

  beforeEach(async () => {
    jenkinsValidation.validateJobUrl.mockReset();
    await prisma.monitor.deleteMany();
    await prisma.serviceDeployment.deleteMany();
    await prisma.subtask.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.service.deleteMany();
  });

  it('POST /services/:id/deployments creates row when Jenkins validation succeeds', async () => {
    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'auth' })
      .expect(201);

    jenkinsValidation.validateJobUrl.mockResolvedValue({
      valid: true,
      preview: {
        jobName: 'auth-dev',
        normalizedJobUrl: 'https://jenkins.example.net/job/auth-dev',
        lastBuild: {
          buildNumber: 42,
          status: 'success',
          buildUrl: 'https://jenkins.example.net/job/auth-dev/42/',
          durationMs: 120000,
          timestamp: 1700000000000,
        },
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/services/${serviceRes.body.id}/deployments`)
      .send({
        environment: 'dev',
        jobUrl: 'https://jenkins.example.net/job/auth-dev/42',
      })
      .expect(201);

    expect(response.body.deployment).toMatchObject({
      serviceId: serviceRes.body.id,
      environment: 'dev',
      jobUrl: 'https://jenkins.example.net/job/auth-dev',
    });
    expect(response.body.validation.jobName).toBe('auth-dev');

    const service = await request(app.getHttpServer())
      .get(`/services/${serviceRes.body.id}`)
      .expect(200);
    expect(service.body.deployments).toHaveLength(1);
  });

  it('POST /services/:id/deployments returns 400 when Jenkins validation fails', async () => {
    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'auth' })
      .expect(201);

    jenkinsValidation.validateJobUrl.mockResolvedValue({
      valid: false,
      error: 'Jenkins API returned 404',
    });

    await request(app.getHttpServer())
      .post(`/services/${serviceRes.body.id}/deployments`)
      .send({
        environment: 'dev',
        jobUrl: 'https://jenkins.example.net/job/missing',
      })
      .expect(400);

    const count = await prisma.serviceDeployment.count();
    expect(count).toBe(0);
  });

  it('POST /services/:id/deployments returns 409 for duplicate environment', async () => {
    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'auth' })
      .expect(201);

    jenkinsValidation.validateJobUrl.mockResolvedValue({
      valid: true,
      preview: {
        jobName: 'auth-dev',
        normalizedJobUrl: 'https://jenkins.example.net/job/auth-dev',
        lastBuild: null,
      },
    });

    await request(app.getHttpServer())
      .post(`/services/${serviceRes.body.id}/deployments`)
      .send({ environment: 'dev', jobUrl: 'https://jenkins.example.net/job/auth-dev' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/services/${serviceRes.body.id}/deployments`)
      .send({ environment: 'dev', jobUrl: 'https://jenkins.example.net/job/auth-dev-2' })
      .expect(409);
  });

  it('PATCH /services/:serviceId/deployments/:deploymentId updates job URL after validation', async () => {
    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'auth' })
      .expect(201);

    jenkinsValidation.validateJobUrl.mockResolvedValue({
      valid: true,
      preview: {
        jobName: 'auth-dev',
        normalizedJobUrl: 'https://jenkins.example.net/job/auth-dev',
        lastBuild: null,
      },
    });

    const createRes = await request(app.getHttpServer())
      .post(`/services/${serviceRes.body.id}/deployments`)
      .send({ environment: 'dev', jobUrl: 'https://jenkins.example.net/job/auth-dev' })
      .expect(201);

    jenkinsValidation.validateJobUrl.mockResolvedValue({
      valid: true,
      preview: {
        jobName: 'auth-uat',
        normalizedJobUrl: 'https://jenkins.example.net/job/auth-uat',
        lastBuild: null,
      },
    });

    const patchRes = await request(app.getHttpServer())
      .patch(`/services/${serviceRes.body.id}/deployments/${createRes.body.deployment.id}`)
      .send({ jobUrl: 'https://jenkins.example.net/job/auth-uat' })
      .expect(200);

    expect(patchRes.body.deployment).toMatchObject({
      environment: 'dev',
      jobUrl: 'https://jenkins.example.net/job/auth-uat',
    });
  });

  it('DELETE /services/:serviceId/deployments/:deploymentId removes row', async () => {
    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .send({ keyName: 'auth' })
      .expect(201);

    jenkinsValidation.validateJobUrl.mockResolvedValue({
      valid: true,
      preview: {
        jobName: 'auth-dev',
        normalizedJobUrl: 'https://jenkins.example.net/job/auth-dev',
        lastBuild: null,
      },
    });

    const createRes = await request(app.getHttpServer())
      .post(`/services/${serviceRes.body.id}/deployments`)
      .send({ environment: 'dev', jobUrl: 'https://jenkins.example.net/job/auth-dev' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/services/${serviceRes.body.id}/deployments/${createRes.body.deployment.id}`)
      .expect(204);

    const service = await request(app.getHttpServer())
      .get(`/services/${serviceRes.body.id}`)
      .expect(200);
    expect(service.body.deployments).toHaveLength(0);
  });
});
