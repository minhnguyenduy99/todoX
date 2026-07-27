import {
  DeployedEnvironmentName,
  MonitorType,
} from '@todo-platform/shared-types';
import { resolveMonitorEnvKey } from './monitor-env-key';

describe('resolveMonitorEnvKey', () => {
  it('maps deployment env to prisma env key', () => {
    expect(
      resolveMonitorEnvKey(MonitorType.DEPLOYMENT, {
        env: DeployedEnvironmentName.DEV,
      }),
    ).toBe('dev');
    expect(
      resolveMonitorEnvKey(MonitorType.DEPLOYMENT, {
        env: DeployedEnvironmentName.UAT_MAIN,
      }),
    ).toBe('uat_main');
  });

  it('uses monitor type for non-deployment monitors', () => {
    expect(resolveMonitorEnvKey(MonitorType.HTTP, {})).toBe(MonitorType.HTTP);
  });

  it('returns null when deployment env is missing', () => {
    expect(resolveMonitorEnvKey(MonitorType.DEPLOYMENT, {})).toBeNull();
  });
});
