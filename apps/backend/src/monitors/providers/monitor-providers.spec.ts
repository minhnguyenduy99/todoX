import {
  HttpMonitorProvider,
  GitHubPrMonitorProvider,
  DeploymentMonitorProvider,
} from './monitor-providers';
import { MonitorResultStatus, MonitorType } from '@todo-platform/shared-types';

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

describe('DeploymentMonitorProvider', () => {
  let provider: DeploymentMonitorProvider;

  beforeEach(() => {
    provider = new DeploymentMonitorProvider();
  });

  it('should fail when url is missing', async () => {
    const result = await provider.check({});
    expect(result.status).toBe(MonitorResultStatus.FAILED);
  });

  it('should have correct type', () => {
    expect(provider.type).toBe(MonitorType.DEPLOYMENT);
  });
});
