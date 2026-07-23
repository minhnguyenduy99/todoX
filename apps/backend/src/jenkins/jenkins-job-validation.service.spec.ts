import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DeploymentStatus } from '@todo-platform/shared-types';
import { JenkinsJobValidationService } from './jenkins-job-validation.service';

describe('JenkinsJobValidationService', () => {
  let service: JenkinsJobValidationService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JenkinsJobValidationService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'JENKINS_AUTH' ? 'dGVzdDp0ZXN0' : undefined),
          },
        },
      ],
    }).compile();

    service = module.get(JenkinsJobValidationService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns valid preview when Jenkins job exists with last build', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'auth-dev',
        url: 'https://jenkins.example.net/job/auth-dev/',
        lastBuild: {
          number: 42,
          result: 'SUCCESS',
          building: false,
          duration: 120000,
          timestamp: 1700000000000,
          url: 'https://jenkins.example.net/job/auth-dev/42/',
        },
      }),
    }) as typeof fetch;

    const result = await service.validateJobUrl(
      'https://jenkins.example.net/job/auth-dev/42',
    );

    expect(result.valid).toBe(true);
    expect(result.preview).toMatchObject({
      jobName: 'auth-dev',
      normalizedJobUrl: 'https://jenkins.example.net/job/auth-dev',
      lastBuild: {
        buildNumber: 42,
        status: DeploymentStatus.SUCCESS,
      },
    });
  });

  it('returns valid when job exists but has no builds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'auth-dev',
        lastBuild: null,
      }),
    }) as typeof fetch;

    const result = await service.validateJobUrl('https://jenkins.example.net/job/auth-dev');

    expect(result.valid).toBe(true);
    expect(result.preview?.lastBuild).toBeNull();
  });

  it('returns invalid when Jenkins responds 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as typeof fetch;

    const result = await service.validateJobUrl('https://jenkins.example.net/job/missing');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('404');
  });

  it('returns invalid when JENKINS_AUTH is missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JenkinsJobValidationService,
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile();

    const unconfigured = module.get(JenkinsJobValidationService);
    const result = await unconfigured.validateJobUrl('https://jenkins.example.net/job/auth-dev');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('JENKINS_AUTH');
  });
});
