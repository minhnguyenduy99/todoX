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

/**
 * Release status aggregation:
 * - create / no successes yet → in_progress
 * - ≥1 service successful, not all → partial_success
 * - all services successful → successful
 * - all services failed → failed
 */
export function aggregateReleaseStatus(
  memberServiceIds: string[],
  deploymentsByServiceId: Map<string, ReleaseDeploymentStatus>,
): ReleaseStatus {
  if (memberServiceIds.length === 0) {
    return ReleaseStatus.IN_PROGRESS;
  }

  const outcomes = memberServiceIds.map(
    (serviceId) => deploymentsByServiceId.get(serviceId) ?? null,
  );

  const successCount = outcomes.filter(
    (outcome) => outcome === ReleaseDeploymentStatus.SUCCESSFUL,
  ).length;
  const failedCount = outcomes.filter(
    (outcome) => outcome === ReleaseDeploymentStatus.FAILED,
  ).length;

  if (successCount === memberServiceIds.length) {
    return ReleaseStatus.SUCCESSFUL;
  }
  if (failedCount === memberServiceIds.length) {
    return ReleaseStatus.FAILED;
  }
  if (successCount > 0) {
    return ReleaseStatus.PARTIAL_SUCCESS;
  }
  return ReleaseStatus.IN_PROGRESS;
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

export type ServiceMemberSnapshot = {
  activeStatuses: string[];
  archivedCount: number;
};

/** Merge Jenkins deployment outcomes with member todo progress. */
export function resolveServiceOutcomes(params: {
  releaseType: string;
  memberServiceIds: string[];
  deploymentsByServiceId: Map<string, ReleaseDeploymentStatus>;
  membersByServiceId: Map<string, ServiceMemberSnapshot>;
}): Map<string, ReleaseDeploymentStatus> {
  const out = new Map<string, ReleaseDeploymentStatus>();
  const releaseType = String(params.releaseType) === 'prod' ? 'prod' : 'staging';

  for (const serviceId of params.memberServiceIds) {
    const dep = params.deploymentsByServiceId.get(serviceId);
    const members = params.membersByServiceId.get(serviceId) ?? {
      activeStatuses: [],
      archivedCount: 0,
    };

    let fromTodos: ReleaseDeploymentStatus | undefined;
    if (releaseType === 'staging') {
      if (
        members.activeStatuses.length > 0 &&
        members.activeStatuses.every((status) => status === 'COMPLETED')
      ) {
        fromTodos = ReleaseDeploymentStatus.SUCCESSFUL;
      } else if (members.activeStatuses.some((status) => status === 'COMPLETED')) {
        fromTodos = ReleaseDeploymentStatus.IN_PROGRESS;
      }
    } else if (members.activeStatuses.length === 0 && members.archivedCount > 0) {
      fromTodos = ReleaseDeploymentStatus.SUCCESSFUL;
    } else if (members.archivedCount > 0 && members.activeStatuses.length > 0) {
      fromTodos = ReleaseDeploymentStatus.IN_PROGRESS;
    }

    if (
      fromTodos === ReleaseDeploymentStatus.SUCCESSFUL ||
      dep === ReleaseDeploymentStatus.SUCCESSFUL
    ) {
      out.set(serviceId, ReleaseDeploymentStatus.SUCCESSFUL);
    } else if (dep === ReleaseDeploymentStatus.FAILED) {
      out.set(serviceId, ReleaseDeploymentStatus.FAILED);
    } else if (
      dep === ReleaseDeploymentStatus.IN_PROGRESS ||
      dep === ReleaseDeploymentStatus.PENDING ||
      fromTodos === ReleaseDeploymentStatus.IN_PROGRESS
    ) {
      out.set(
        serviceId,
        dep === ReleaseDeploymentStatus.PENDING && fromTodos === undefined
          ? ReleaseDeploymentStatus.PENDING
          : ReleaseDeploymentStatus.IN_PROGRESS,
      );
    }
  }

  return out;
}
