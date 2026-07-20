import {
  DeployedEnvironmentName,
  MonitorResultStatus,
  MonitorType,
  type MonitorResult,
} from '@todo-platform/shared-types';
import {
  isUatDeploymentMonitor,
  resolveTodoStatusOnDeploySuccess,
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
  const running: MonitorResult = { status: MonitorResultStatus.RUNNING, message: 'running' };

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

  describe('resolveTodoStatusOnDeploySuccess', () => {
    it('returns TESTING for uat', () => {
      expect(
        resolveTodoStatusOnDeploySuccess(
          running,
          success,
          MonitorType.DEPLOYMENT,
          uatConfig,
        ),
      ).toBe(TodoStatus.TESTING);
    });

    it('returns WAIT_FOR_STAGING for uat-main', () => {
      expect(
        resolveTodoStatusOnDeploySuccess(
          running,
          success,
          MonitorType.DEPLOYMENT,
          uatMainConfig,
        ),
      ).toBe(TodoStatus.WAIT_FOR_STAGING);
    });

    it('returns null for dev deployment', () => {
      expect(
        resolveTodoStatusOnDeploySuccess(
          running,
          success,
          MonitorType.DEPLOYMENT,
          { ...uatConfig, env: DeployedEnvironmentName.DEV },
        ),
      ).toBeNull();
    });
  });
});
