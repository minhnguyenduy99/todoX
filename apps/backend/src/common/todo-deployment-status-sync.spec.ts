import {
  DeployedEnvironmentName,
  DeploymentStatus,
  MonitorResultStatus,
  MonitorType,
  type MonitorResult,
} from '@todo-platform/shared-types';
import {
  areAllAssociatedPullRequestsMerged,
  isUatDeploymentMonitor,
  isTodoStatusSyncSuppressedForDeploymentMonitor,
  reconcileTodoStatusFromDeploymentMonitors,
  resolveTodoStatusFromSuccessfulDeployPoll,
  resolveTodoStatusOnDeploySuccess,
  shouldApplyTodoStatusTransition,
  shouldKeepDeploymentMonitorActiveAfterPoll,
  shouldSetTodoTestingOnDeployResult,
  shouldSetTodoWaitForStagingOnDeployResult,
} from './todo-deployment-status-sync';
import { TodoStatus } from '@todo-platform/shared-types';

describe('todo-deployment-status-sync', () => {
  const uatConfig = {
    env: DeployedEnvironmentName.UAT,
    jobUrl: 'https://jenkins/job/uat',
    buildNumber: 1,
  };

  const uatMainConfig = {
    env: DeployedEnvironmentName.UAT_MAIN,
    jobUrl: 'https://jenkins/job/uat-main',
    buildNumber: 2,
  };

  const success: MonitorResult = { status: MonitorResultStatus.SUCCESS, message: 'ok' };
  const failed: MonitorResult = {
    status: MonitorResultStatus.FAILED,
    message: 'Deployment failed',
    metadata: { deployment: { status: DeploymentStatus.FAIL } },
  };
  const running: MonitorResult = { status: MonitorResultStatus.RUNNING, message: 'running' };

  const mergedPr = [{ status: 'merged' }];
  const openPr = [{ status: 'open' }];

  describe('isUatDeploymentMonitor', () => {
    it('returns true for deployment monitor targeting uat', () => {
      expect(isUatDeploymentMonitor(MonitorType.DEPLOYMENT, uatConfig)).toBe(true);
    });

    it('returns false for dev deployment monitor', () => {
      expect(
        isUatDeploymentMonitor(MonitorType.DEPLOYMENT, {
          ...uatConfig,
          env: DeployedEnvironmentName.DEV,
        }),
      ).toBe(false);
    });

    it('returns false for non-deployment monitors', () => {
      expect(isUatDeploymentMonitor(MonitorType.HTTP, uatConfig)).toBe(false);
    });
  });

  describe('shouldSetTodoTestingOnDeployResult', () => {
    it('returns true on first UAT deploy success', () => {
      expect(
        shouldSetTodoTestingOnDeployResult(
          null,
          success,
          MonitorType.DEPLOYMENT,
          uatConfig,
        ),
      ).toBe(true);
    });

    it('returns true when transitioning from running to success', () => {
      expect(
        shouldSetTodoTestingOnDeployResult(
          running,
          success,
          MonitorType.DEPLOYMENT,
          uatConfig,
        ),
      ).toBe(true);
    });

    it('returns false when already successful', () => {
      expect(
        shouldSetTodoTestingOnDeployResult(
          success,
          success,
          MonitorType.DEPLOYMENT,
          uatConfig,
        ),
      ).toBe(false);
    });

    it('returns false for non-uat monitors', () => {
      expect(
        shouldSetTodoTestingOnDeployResult(
          running,
          success,
          MonitorType.DEPLOYMENT,
          { ...uatConfig, env: DeployedEnvironmentName.DEV },
        ),
      ).toBe(false);
    });
  });

  describe('shouldSetTodoWaitForStagingOnDeployResult', () => {
    it('returns true on first uat-main deploy success', () => {
      expect(
        shouldSetTodoWaitForStagingOnDeployResult(
          null,
          success,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
        ),
      ).toBe(true);
    });

    it('returns false when already successful', () => {
      expect(
        shouldSetTodoWaitForStagingOnDeployResult(
          success,
          success,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
        ),
      ).toBe(false);
    });
  });

  describe('areAllAssociatedPullRequestsMerged', () => {
    it('returns true when every PR is merged', () => {
      expect(areAllAssociatedPullRequestsMerged([{ status: 'merged' }])).toBe(true);
    });

    it('returns false when any PR is open', () => {
      expect(areAllAssociatedPullRequestsMerged(openPr)).toBe(false);
    });

    it('returns true when there are no PRs', () => {
      expect(areAllAssociatedPullRequestsMerged([])).toBe(true);
    });
  });

  describe('isTodoStatusSyncSuppressedForDeploymentMonitor', () => {
    it('returns true when suppressTodoStatusSync is set', () => {
      expect(
        isTodoStatusSyncSuppressedForDeploymentMonitor({
          ...uatMainConfig,
          suppressTodoStatusSync: true,
        }),
      ).toBe(true);
    });

    it('returns false for normal deployment monitors', () => {
      expect(isTodoStatusSyncSuppressedForDeploymentMonitor(uatMainConfig)).toBe(false);
    });
  });

  describe('shouldApplyTodoStatusTransition', () => {
    it('allows IN_PROGRESS to advance to TESTING', () => {
      expect(
        shouldApplyTodoStatusTransition(TodoStatus.IN_PROGRESS, TodoStatus.TESTING),
      ).toBe(true);
    });

    it('allows TESTING to advance to WAIT_FOR_STAGING', () => {
      expect(
        shouldApplyTodoStatusTransition(TodoStatus.TESTING, TodoStatus.WAIT_FOR_STAGING),
      ).toBe(true);
    });

    it('blocks WAIT_FOR_STAGING from regressing to TESTING', () => {
      expect(
        shouldApplyTodoStatusTransition(TodoStatus.WAIT_FOR_STAGING, TodoStatus.TESTING),
      ).toBe(false);
    });

    it('blocks COMPLETED from regressing to TESTING', () => {
      expect(
        shouldApplyTodoStatusTransition(TodoStatus.COMPLETED, TodoStatus.TESTING),
      ).toBe(false);
    });
  });

  describe('resolveTodoStatusFromSuccessfulDeployPoll', () => {
    it('returns TESTING for uat on any successful poll while behind', () => {
      expect(
        resolveTodoStatusFromSuccessfulDeployPoll(
          success,
          MonitorType.DEPLOYMENT,
          uatConfig,
          TodoStatus.IN_PROGRESS,
          openPr,
        ),
      ).toBe(TodoStatus.TESTING);
    });

    it('retries uat-main on repeated success polls while still TESTING', () => {
      expect(
        resolveTodoStatusFromSuccessfulDeployPoll(
          success,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.TESTING,
          mergedPr,
        ),
      ).toBe(TodoStatus.WAIT_FOR_STAGING);
    });

    it('blocks uat-main advance when PRs are not merged', () => {
      expect(
        resolveTodoStatusFromSuccessfulDeployPoll(
          success,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.TESTING,
          openPr,
        ),
      ).toBeNull();
    });

    it('returns null when already at target status', () => {
      expect(
        resolveTodoStatusFromSuccessfulDeployPoll(
          success,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.WAIT_FOR_STAGING,
          mergedPr,
        ),
      ).toBeNull();
    });

    it('returns null for dev deployment', () => {
      expect(
        resolveTodoStatusFromSuccessfulDeployPoll(
          success,
          MonitorType.DEPLOYMENT,
          { ...uatConfig, env: DeployedEnvironmentName.DEV },
          TodoStatus.IN_PROGRESS,
          mergedPr,
        ),
      ).toBeNull();
    });

    it('returns null when poll is not successful', () => {
      expect(
        resolveTodoStatusFromSuccessfulDeployPoll(
          running,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.TESTING,
          mergedPr,
        ),
      ).toBeNull();
    });
  });

  describe('resolveTodoStatusOnDeploySuccess', () => {
    it('delegates to level-triggered resolver with PR gating', () => {
      expect(
        resolveTodoStatusOnDeploySuccess(
          running,
          success,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.TESTING,
          mergedPr,
        ),
      ).toBe(TodoStatus.WAIT_FOR_STAGING);
    });
  });

  describe('shouldKeepDeploymentMonitorActiveAfterPoll', () => {
    it('keeps polling while build is running', () => {
      expect(
        shouldKeepDeploymentMonitorActiveAfterPoll(
          running,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.TESTING,
          openPr,
        ),
      ).toBe(true);
    });

    it('keeps polling after success while PRs block uat-main advance', () => {
      expect(
        shouldKeepDeploymentMonitorActiveAfterPoll(
          success,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.TESTING,
          openPr,
        ),
      ).toBe(true);
    });

    it('stops polling after success once uat-main status is applied', () => {
      expect(
        shouldKeepDeploymentMonitorActiveAfterPoll(
          success,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.WAIT_FOR_STAGING,
          mergedPr,
        ),
      ).toBe(false);
    });

    it('stops polling after failed deploy', () => {
      expect(
        shouldKeepDeploymentMonitorActiveAfterPoll(
          failed,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.TESTING,
          mergedPr,
        ),
      ).toBe(false);
    });

    it('keeps polling after Jenkins poll errors', () => {
      expect(
        shouldKeepDeploymentMonitorActiveAfterPoll(
          {
            status: MonitorResultStatus.FAILED,
            message: 'Jenkins API returned 403',
            metadata: { statusCode: 403 },
          },
          MonitorType.DEPLOYMENT,
          uatMainConfig,
          TodoStatus.TESTING,
          mergedPr,
        ),
      ).toBe(true);
    });
  });

  describe('reconcileTodoStatusFromDeploymentMonitors', () => {
    it('picks the highest applicable target from multiple monitors', () => {
      expect(
        reconcileTodoStatusFromDeploymentMonitors(
          TodoStatus.IN_PROGRESS,
          mergedPr,
          [
            {
              type: MonitorType.DEPLOYMENT,
              config: uatConfig,
              lastResult: success,
            },
            {
              type: MonitorType.DEPLOYMENT,
              config: uatMainConfig,
              lastResult: success,
            },
          ],
        ),
      ).toBe(TodoStatus.WAIT_FOR_STAGING);
    });

    it('returns null when uat-main succeeded but PRs are open', () => {
      expect(
        reconcileTodoStatusFromDeploymentMonitors(
          TodoStatus.TESTING,
          openPr,
          [
            {
              type: MonitorType.DEPLOYMENT,
              config: uatMainConfig,
              lastResult: success,
            },
          ],
        ),
      ).toBeNull();
    });
  });
});
