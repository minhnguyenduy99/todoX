import {
  MonitorResultStatus,
  ReleaseDeploymentStatus,
  ReleaseStatus,
  type MonitorResult,
} from '@todo-platform/shared-types';

export function mapMonitorResultToDeploymentStatus(
  result: MonitorResult | null,
): ReleaseDeploymentStatus {
  if (!result) return ReleaseDeploymentStatus.PENDING;
  switch (result.status) {
    case MonitorResultStatus.SUCCESS:
      return ReleaseDeploymentStatus.SUCCESSFUL;
    case MonitorResultStatus.FAILED:
      return ReleaseDeploymentStatus.FAILED;
    case MonitorResultStatus.RUNNING:
      return ReleaseDeploymentStatus.IN_PROGRESS;
    default:
      return ReleaseDeploymentStatus.PENDING;
  }
}

export function aggregateReleaseStatus(
  memberServiceIds: string[],
  deploymentsByServiceId: Map<string, ReleaseDeploymentStatus>,
): ReleaseStatus {
  if (memberServiceIds.length === 0) {
    return ReleaseStatus.NOT_STARTED;
  }

  const outcomes = memberServiceIds.map(
    (serviceId) => deploymentsByServiceId.get(serviceId) ?? null,
  );

  const hasAnyDeployment = outcomes.some((outcome) => outcome != null);
  if (!hasAnyDeployment) {
    return ReleaseStatus.NOT_STARTED;
  }

  const terminal = new Set([
    ReleaseDeploymentStatus.SUCCESSFUL,
    ReleaseDeploymentStatus.FAILED,
  ]);
  const allTerminal = outcomes.every(
    (outcome) => outcome != null && terminal.has(outcome),
  );
  if (!allTerminal) {
    return ReleaseStatus.IN_PROGRESS;
  }

  if (outcomes.every((outcome) => outcome === ReleaseDeploymentStatus.SUCCESSFUL)) {
    return ReleaseStatus.SUCCESSFUL;
  }
  if (outcomes.every((outcome) => outcome === ReleaseDeploymentStatus.FAILED)) {
    return ReleaseStatus.FAILED;
  }
  return ReleaseStatus.PARTIAL_SUCCESS;
}

export function shouldApplyFirstSuccessSideEffect(
  previousStatus: ReleaseDeploymentStatus,
  nextStatus: ReleaseDeploymentStatus,
): boolean {
  return (
    nextStatus === ReleaseDeploymentStatus.SUCCESSFUL &&
    previousStatus !== ReleaseDeploymentStatus.SUCCESSFUL
  );
}
