import {
  DeploymentStatus,
  MonitorResultStatus,
} from '@todo-platform/shared-types';
import { isDeploymentMonitorPollError } from './monitor-poll-error';

describe('isDeploymentMonitorPollError', () => {
  it('returns true for Jenkins HTTP errors without deployment metadata', () => {
    expect(
      isDeploymentMonitorPollError({
        status: MonitorResultStatus.FAILED,
        message: 'Jenkins API returned 403',
        metadata: { statusCode: 403 },
      }),
    ).toBe(true);
  });

  it('returns true for network and config failures', () => {
    expect(
      isDeploymentMonitorPollError({
        status: MonitorResultStatus.FAILED,
        message: 'Jenkins deployment check failed: timeout',
      }),
    ).toBe(true);
    expect(
      isDeploymentMonitorPollError({
        status: MonitorResultStatus.FAILED,
        message: 'JENKINS_AUTH is not configured',
      }),
    ).toBe(true);
  });

  it('returns false for real Jenkins build failures', () => {
    expect(
      isDeploymentMonitorPollError({
        status: MonitorResultStatus.FAILED,
        message: 'Deployment to staging build #52 failed',
        metadata: {
          deployment: { status: DeploymentStatus.FAIL },
        },
      }),
    ).toBe(false);
  });

  it('returns false for non-failed monitor results', () => {
    expect(
      isDeploymentMonitorPollError({
        status: MonitorResultStatus.RUNNING,
        message: 'running',
        metadata: {
          deployment: { status: DeploymentStatus.IN_PROGRESS },
        },
      }),
    ).toBe(false);
  });
});
