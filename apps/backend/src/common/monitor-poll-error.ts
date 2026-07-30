import {
  DeploymentStatus,
  MonitorResultStatus,
  type MonitorResult,
} from '@todo-platform/shared-types';

/** Jenkins poll/config errors must not be treated as deployment failures. */
export function isDeploymentMonitorPollError(result: MonitorResult): boolean {
  if (result.status !== MonitorResultStatus.FAILED) return false;

  const deployment = result.metadata?.deployment as
    | { status?: DeploymentStatus }
    | undefined;

  return deployment?.status !== DeploymentStatus.FAIL;
}
