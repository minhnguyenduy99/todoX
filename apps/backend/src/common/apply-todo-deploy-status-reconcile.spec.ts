import { MonitorResultStatus, MonitorType, TodoStatus } from '@todo-platform/shared-types';
import {
  areAllAssociatedPullRequestsMerged,
  resolveTodoStatusFromSuccessfulDeployPoll,
  shouldKeepDeploymentMonitorActiveAfterPoll,
} from './todo-deployment-status-sync';

describe('apply-todo-deploy-status-reconcile helpers', () => {
  it('documents PR gate before wait-for-staging', () => {
    const success = { status: MonitorResultStatus.SUCCESS, message: 'ok' };
    const uatMainConfig = {
      env: 'uat-main',
      jobUrl: 'https://jenkins/job/uat-main',
      buildNumber: 1,
    };

    expect(
      resolveTodoStatusFromSuccessfulDeployPoll(
        success,
        MonitorType.DEPLOYMENT,
        uatMainConfig,
        TodoStatus.TESTING,
        [{ status: 'open' }],
      ),
    ).toBeNull();

    expect(areAllAssociatedPullRequestsMerged([{ status: 'open' }])).toBe(false);

    expect(
      shouldKeepDeploymentMonitorActiveAfterPoll(
        success,
        MonitorType.DEPLOYMENT,
        uatMainConfig,
        TodoStatus.TESTING,
        [{ status: 'open' }],
      ),
    ).toBe(true);
  });
});
