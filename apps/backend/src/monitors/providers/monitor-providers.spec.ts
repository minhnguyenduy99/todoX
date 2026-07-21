import {
  DeploymentMonitorProvider,
  GitHubPrMonitorProvider,
  HttpMonitorProvider,
  TestcaseScanMonitorProvider,
  mapJenkinsBuildToDeployment,
  mapJenkinsBuildToScan,
  parseJobNameFromUrl,
} from './monitor-providers';
import {
  DeployedEnvironmentName,
  DeploymentStatus,
  MonitorResultStatus,
  MonitorType,
} from '@todo-platform/shared-types';

describe('HttpMonitorProvider', () => {
  let provider: HttpMonitorProvider;

  beforeEach(() => {
    provider = new HttpMonitorProvider();
  });

  it('should fail when url is missing', async () => {
    const result = await provider.check({});
    expect(result.status).toBe(MonitorResultStatus.FAILED);
    expect(result.message).toContain('Missing url');
  });

  it('should have correct type', () => {
    expect(provider.type).toBe(MonitorType.HTTP);
  });
});

describe('GitHubPrMonitorProvider', () => {
  it('should fail when config is incomplete', async () => {
    const provider = new GitHubPrMonitorProvider({
      get: () => undefined,
    } as never);
    const result = await provider.check({ owner: 'test' });
    expect(result.status).toBe(MonitorResultStatus.FAILED);
  });
});

describe('parseJobNameFromUrl', () => {
  it('extracts the last path segment as job name', () => {
    expect(
      parseJobNameFromUrl(
        'https://jenkins2.flodev.net/job/backend-nodejs-4-1.backend.dev.deploy',
      ),
    ).toBe('backend-nodejs-4-1.backend.dev.deploy');
  });
});

describe('mapJenkinsBuildToDeployment', () => {
  const cfg = {
    env: DeployedEnvironmentName.DEV,
    jobUrl: 'https://jenkins.example.net/job/my-job',
    buildNumber: 2790,
  };

  it('maps building true to in_progress', () => {
    const { deployment, monitorStatus } = mapJenkinsBuildToDeployment(cfg, {
      building: true,
      result: null,
      duration: 0,
      timestamp: 1784521296700,
      url: 'https://jenkins.example.net/job/my-job/2790/',
    });
    expect(deployment.status).toBe(DeploymentStatus.IN_PROGRESS);
    expect(monitorStatus).toBe(MonitorResultStatus.RUNNING);
  });

  it('maps SUCCESS to success with duration', () => {
    const { deployment, monitorStatus } = mapJenkinsBuildToDeployment(cfg, {
      building: false,
      result: 'SUCCESS',
      duration: 2303459,
      timestamp: 1784521296700,
      url: 'https://jenkins.example.net/job/my-job/2790/',
    });
    expect(deployment.status).toBe(DeploymentStatus.SUCCESS);
    expect(deployment.durationMs).toBe(2303459);
    expect(monitorStatus).toBe(MonitorResultStatus.SUCCESS);
  });

  it('maps FAILURE to fail', () => {
    const { deployment, monitorStatus } = mapJenkinsBuildToDeployment(cfg, {
      building: false,
      result: 'FAILURE',
      duration: 1000,
      timestamp: 1784521296700,
      url: 'https://jenkins.example.net/job/my-job/2790/',
    });
    expect(deployment.status).toBe(DeploymentStatus.FAIL);
    expect(monitorStatus).toBe(MonitorResultStatus.FAILED);
  });
});

describe('DeploymentMonitorProvider', () => {
  const cfg = {
    env: DeployedEnvironmentName.DEV,
    jobUrl: 'https://jenkins.example.net/job/my-job',
    buildNumber: 2790,
  };

  function createProvider(auth?: string): DeploymentMonitorProvider {
    return new DeploymentMonitorProvider({
      get: (key: string) => (key === 'JENKINS_AUTH' ? auth : undefined),
    } as never);
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should fail when config is incomplete', async () => {
    const provider = createProvider('token');
    const result = await provider.check({ env: 'dev' });
    expect(result.status).toBe(MonitorResultStatus.FAILED);
    expect(result.message).toContain('Missing env, jobUrl, or buildNumber');
  });

  it('should fail when JENKINS_AUTH is missing', async () => {
    const provider = createProvider(undefined);
    const result = await provider.check(cfg);
    expect(result.status).toBe(MonitorResultStatus.FAILED);
    expect(result.message).toContain('JENKINS_AUTH');
  });

  it('should have correct type', () => {
    expect(createProvider().type).toBe(MonitorType.DEPLOYMENT);
  });

  it('returns running when Jenkins build is in progress', async () => {
    const provider = createProvider('dG9rZW4=');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        building: true,
        result: null,
        duration: 0,
        timestamp: 1784521296700,
        url: 'https://jenkins.example.net/job/my-job/2790/',
      }),
    } as Response);

    const result = await provider.check(cfg);
    expect(result.status).toBe(MonitorResultStatus.RUNNING);
    expect(result.metadata?.deployment).toMatchObject({
      env: DeployedEnvironmentName.DEV,
      buildNumber: 2790,
      status: DeploymentStatus.IN_PROGRESS,
    });
  });

  it('returns success when Jenkins build succeeded', async () => {
    const provider = createProvider('dG9rZW4=');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        building: false,
        result: 'SUCCESS',
        duration: 2303459,
        timestamp: 1784521296700,
        url: 'https://jenkins.example.net/job/my-job/2790/',
      }),
    } as Response);

    const result = await provider.check(cfg);
    expect(result.status).toBe(MonitorResultStatus.SUCCESS);
    expect(result.metadata?.deployment).toMatchObject({
      status: DeploymentStatus.SUCCESS,
      durationMs: 2303459,
    });
  });

  it('returns failed when Jenkins build failed', async () => {
    const provider = createProvider('dG9rZW4=');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        building: false,
        result: 'FAILURE',
        duration: 1000,
        timestamp: 1784521296700,
        url: 'https://jenkins.example.net/job/my-job/2790/',
      }),
    } as Response);

    const result = await provider.check(cfg);
    expect(result.status).toBe(MonitorResultStatus.FAILED);
    expect(result.metadata?.deployment).toMatchObject({
      status: DeploymentStatus.FAIL,
    });
  });

  it('returns failed when Jenkins API returns 404', async () => {
    const provider = createProvider('dG9rZW4=');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const result = await provider.check(cfg);
    expect(result.status).toBe(MonitorResultStatus.FAILED);
    expect(result.message).toContain('404');
  });

  it('returns failed on network error', async () => {
    const provider = createProvider('dG9rZW4=');
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const result = await provider.check(cfg);
    expect(result.status).toBe(MonitorResultStatus.FAILED);
    expect(result.message).toContain('network down');
  });
});

describe('mapJenkinsBuildToScan', () => {
  const cfg = {
    jobUrl: 'https://jenkins-scan.example.net/job/test-scan',
    buildNumber: 42,
  };

  it('maps building true to in_progress', () => {
    const { scan, monitorStatus } = mapJenkinsBuildToScan(cfg, {
      building: true,
      result: null,
      duration: 0,
      timestamp: 1,
      url: 'https://jenkins-scan.example.net/job/test-scan/42/',
    });
    expect(scan.status).toBe(DeploymentStatus.IN_PROGRESS);
    expect(monitorStatus).toBe(MonitorResultStatus.RUNNING);
  });

  it('maps UNSTABLE to success when build finished', () => {
    const { scan, monitorStatus } = mapJenkinsBuildToScan(cfg, {
      building: false,
      result: 'UNSTABLE',
      duration: 1000,
      timestamp: 1,
      url: 'https://jenkins-scan.example.net/job/test-scan/42/',
    });
    expect(scan.status).toBe(DeploymentStatus.SUCCESS);
    expect(monitorStatus).toBe(MonitorResultStatus.SUCCESS);
  });
});

describe('TestcaseScanMonitorProvider', () => {
  const cfg = {
    jobUrl: 'https://jenkins-scan.example.net/job/test-scan',
    buildNumber: 42,
  };

  const createProvider = (auth?: string) =>
    new TestcaseScanMonitorProvider({
      get: (_key: string) => auth,
    } as never);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fails when JENKINS_SCAN_AUTH is missing', async () => {
    const provider = createProvider(undefined);
    const result = await provider.check(cfg);
    expect(result.status).toBe(MonitorResultStatus.FAILED);
    expect(result.message).toContain('JENKINS_SCAN_AUTH');
  });

  it('has correct type', () => {
    expect(createProvider().type).toBe(MonitorType.TESTCASE_SCAN);
  });
});
