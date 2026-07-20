import {
  DeployedEnvironmentName,
  MonitorResultStatus,
  MonitorType,
  TodoStatus,
  type DeploymentMonitorConfig,
  type MonitorResult,
} from '@todo-platform/shared-types';

export function isDeploymentMonitorForEnv(
  type: string,
  config: unknown,
  env: DeployedEnvironmentName,
): boolean {
  if (type !== MonitorType.DEPLOYMENT) return false;
  const cfg = config as DeploymentMonitorConfig | null | undefined;
  return cfg?.env === env;
}

export function isUatDeploymentMonitor(type: string, config: unknown): boolean {
  return isDeploymentMonitorForEnv(type, config, DeployedEnvironmentName.UAT);
}

export function isFirstDeploySuccess(
  previousResult: MonitorResult | null,
  newResult: MonitorResult,
): boolean {
  if (newResult.status !== MonitorResultStatus.SUCCESS) return false;
  return previousResult?.status !== MonitorResultStatus.SUCCESS;
}

/** True when a UAT deployment monitor transitions to success (not on every repeat poll). */
export function shouldSetTodoTestingOnDeployResult(
  previousResult: MonitorResult | null,
  newResult: MonitorResult,
  type: string,
  config: unknown,
): boolean {
  return (
    isFirstDeploySuccess(previousResult, newResult) &&
    isUatDeploymentMonitor(type, config)
  );
}

/** True when a uat-main deployment monitor transitions to success. */
export function shouldSetTodoWaitForStagingOnDeployResult(
  previousResult: MonitorResult | null,
  newResult: MonitorResult,
  type: string,
  config: unknown,
): boolean {
  return (
    isFirstDeploySuccess(previousResult, newResult) &&
    isDeploymentMonitorForEnv(type, config, DeployedEnvironmentName.UAT_MAIN)
  );
}

/** Todo status to apply on first successful deployment poll, or null if unchanged. */
export function resolveTodoStatusOnDeploySuccess(
  previousResult: MonitorResult | null,
  newResult: MonitorResult,
  type: string,
  config: unknown,
): TodoStatus | null {
  if (!isFirstDeploySuccess(previousResult, newResult)) return null;

  if (isUatDeploymentMonitor(type, config)) {
    return TodoStatus.TESTING;
  }
  if (isDeploymentMonitorForEnv(type, config, DeployedEnvironmentName.UAT_MAIN)) {
    return TodoStatus.WAIT_FOR_STAGING;
  }
  return null;
}
