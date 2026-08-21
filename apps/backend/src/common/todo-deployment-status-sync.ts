import {
  DeployedEnvironmentName,
  MonitorResultStatus,
  MonitorType,
  TodoStatus,
  type DeploymentInfo,
  type DeploymentMonitorConfig,
  type MonitorResult,
} from '@todo-platform/shared-types';
import { isDeploymentMonitorPollError } from './monitor-poll-error';

/** Minimal monitor snapshot used for deploy-driven todo status sync. */
export type DeploymentMonitorSyncSnapshot = {
  type: string;
  config: unknown;
  lastResult: MonitorResult | null;
  lastRunAt?: Date | null;
};

function deploymentMonitorIdentity(config: unknown): string {
  const cfg = config as DeploymentMonitorConfig | null | undefined;
  if (!cfg) return '';
  return `${cfg.env ?? ''}|${cfg.jobUrl ?? ''}|${cfg.buildNumber ?? ''}`;
}

function isSameDeploymentMonitorSnapshot(
  a: DeploymentMonitorSyncSnapshot,
  b: DeploymentMonitorSyncSnapshot,
): boolean {
  return deploymentMonitorIdentity(a.config) === deploymentMonitorIdentity(b.config);
}

/** Jenkins build timestamp when present; otherwise monitor last poll time. */
export function resolveSuccessfulDeploymentTimestampMs(
  monitor: DeploymentMonitorSyncSnapshot,
): number | null {
  if (!monitor.lastResult || monitor.lastResult.status !== MonitorResultStatus.SUCCESS) {
    return null;
  }

  const deployment = (
    monitor.lastResult.metadata as { deployment?: DeploymentInfo } | undefined
  )?.deployment;
  if (typeof deployment?.timestamp === 'number' && deployment.timestamp > 0) {
    return deployment.timestamp;
  }

  if (monitor.lastRunAt) {
    return monitor.lastRunAt.getTime();
  }

  return null;
}

/** Latest successful deployment monitor by build/poll timestamp. */
export function findLatestSuccessfulDeploymentMonitor(
  monitors: ReadonlyArray<DeploymentMonitorSyncSnapshot>,
): DeploymentMonitorSyncSnapshot | null {
  let latest: DeploymentMonitorSyncSnapshot | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const monitor of monitors) {
    const timestamp = resolveSuccessfulDeploymentTimestampMs(monitor);
    if (timestamp === null) continue;
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latest = monitor;
    }
  }

  return latest;
}

function withPollingMonitorSnapshot(
  monitors: ReadonlyArray<DeploymentMonitorSyncSnapshot>,
  pollingMonitor: DeploymentMonitorSyncSnapshot,
): DeploymentMonitorSyncSnapshot[] {
  const pollingIdentity = deploymentMonitorIdentity(pollingMonitor.config);
  let found = false;
  const merged = monitors.map((monitor) => {
    if (deploymentMonitorIdentity(monitor.config) !== pollingIdentity) {
      return monitor;
    }
    found = true;
    return pollingMonitor;
  });
  return found ? merged : [...merged, pollingMonitor];
}

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

/** Forward-only todo status progression used by deployment monitor sync. */
const TODO_STATUS_PROGRESSION: TodoStatus[] = [
  TodoStatus.NOT_STARTED,
  TodoStatus.IN_PROGRESS,
  TodoStatus.TESTING,
  TodoStatus.WAIT_FOR_STAGING,
  TodoStatus.COMPLETED,
];

function todoStatusRank(status: TodoStatus): number {
  return TODO_STATUS_PROGRESSION.indexOf(status);
}

/** True when a deployment-driven status change advances the todo, never regresses it. */
export function shouldApplyTodoStatusTransition(
  currentStatus: TodoStatus,
  nextStatus: TodoStatus,
): boolean {
  const currentRank = todoStatusRank(currentStatus);
  const nextRank = todoStatusRank(nextStatus);
  if (currentRank === -1 || nextRank === -1) return false;
  return nextRank > currentRank;
}

/** True when a deployment monitor must not drive TodoStatus transitions (release-attached staging monitors). */
export function isTodoStatusSyncSuppressedForDeploymentMonitor(
  config: unknown,
): boolean {
  const cfg = config as DeploymentMonitorConfig | null | undefined;
  return cfg?.suppressTodoStatusSync === true;
}

/** True when every associated PR on the todo is merged (vacuously true when there are none). */
export function areAllAssociatedPullRequestsMerged(
  pullRequests: ReadonlyArray<{ status: string }>,
): boolean {
  return pullRequests.every((pr) => pr.status.toLowerCase() === 'merged');
}

/** Target todo status implied by a successful deployment monitor for its environment. */
export function resolveDeploySuccessTargetStatus(
  type: string,
  config: unknown,
): TodoStatus | null {
  if (isUatDeploymentMonitor(type, config)) {
    return TodoStatus.TESTING;
  }
  if (isDeploymentMonitorForEnv(type, config, DeployedEnvironmentName.UAT_MAIN)) {
    return TodoStatus.WAIT_FOR_STAGING;
  }
  return null;
}

/** True when a successful deploy poll may advance the todo to the env-specific target status. */
export function canAdvanceTodoStatusForDeploySuccess(
  targetStatus: TodoStatus,
  currentStatus: TodoStatus,
  pullRequests: ReadonlyArray<{ status: string }>,
): boolean {
  if (!shouldApplyTodoStatusTransition(currentStatus, targetStatus)) {
    return false;
  }
  if (
    targetStatus === TodoStatus.WAIT_FOR_STAGING &&
    !areAllAssociatedPullRequestsMerged(pullRequests)
  ) {
    return false;
  }
  return true;
}

/**
 * Level-triggered status sync: returns the target status whenever the poll is successful,
 * the todo is still behind that target, and gates (including merged PRs for uat-main) pass.
 * Retries on every poll so release suppression or open PRs cannot permanently consume the edge.
 */
export function resolveTodoStatusFromSuccessfulDeployPoll(
  newResult: MonitorResult,
  type: string,
  config: unknown,
  currentStatus: TodoStatus,
  pullRequests: ReadonlyArray<{ status: string }>,
  allMonitors?: ReadonlyArray<DeploymentMonitorSyncSnapshot>,
): TodoStatus | null {
  if (newResult.status !== MonitorResultStatus.SUCCESS) return null;

  const targetStatus = resolveDeploySuccessTargetStatus(type, config);
  if (!targetStatus) return null;

  if (allMonitors && allMonitors.length > 0) {
    const pollingMonitor: DeploymentMonitorSyncSnapshot = {
      type,
      config,
      lastResult: newResult,
      lastRunAt: new Date(),
    };
    const snapshots = withPollingMonitorSnapshot(allMonitors, pollingMonitor);
    const latest = findLatestSuccessfulDeploymentMonitor(snapshots);
    if (!latest || !isSameDeploymentMonitorSnapshot(latest, pollingMonitor)) {
      return null;
    }
  }

  if (!canAdvanceTodoStatusForDeploySuccess(targetStatus, currentStatus, pullRequests)) {
    return null;
  }

  return targetStatus;
}

/**
 * @deprecated Use resolveTodoStatusFromSuccessfulDeployPoll — kept as alias for callers
 * that only had edge-triggered semantics; now level-triggered with PR gating.
 */
export function resolveTodoStatusOnDeploySuccess(
  _previousResult: MonitorResult | null,
  newResult: MonitorResult,
  type: string,
  config: unknown,
  currentStatus: TodoStatus,
  pullRequests: ReadonlyArray<{ status: string }>,
): TodoStatus | null {
  return resolveTodoStatusFromSuccessfulDeployPoll(
    newResult,
    type,
    config,
    currentStatus,
    pullRequests,
  );
}

/** True while the todo has not yet reached the env-specific deploy target status. */
export function isTodoStatusBehindDeployTarget(
  currentStatus: TodoStatus,
  type: string,
  config: unknown,
): boolean {
  const targetStatus = resolveDeploySuccessTargetStatus(type, config);
  if (!targetStatus) return false;
  return shouldApplyTodoStatusTransition(currentStatus, targetStatus);
}

/** Whether a todo/subtask deployment monitor should keep polling after this result. */
export function shouldKeepDeploymentMonitorActiveAfterPoll(
  result: MonitorResult,
  type: string,
  config: unknown,
  currentStatus: TodoStatus,
  _pullRequests: ReadonlyArray<{ status: string }>,
): boolean {
  if (type !== MonitorType.DEPLOYMENT) return false;
  if (isDeploymentMonitorPollError(result)) return true;
  if (result.status === MonitorResultStatus.RUNNING) return true;
  if (result.status === MonitorResultStatus.FAILED) return false;
  if (result.status !== MonitorResultStatus.SUCCESS) return false;

  return isTodoStatusBehindDeployTarget(currentStatus, type, config);
}

/**
 * Status sync uses only the latest successful deployment monitor so stale uat
 * success cannot re-advance a todo after a newer dev deploy.
 */
export function reconcileTodoStatusFromDeploymentMonitors(
  currentStatus: TodoStatus,
  pullRequests: ReadonlyArray<{ status: string }>,
  monitors: ReadonlyArray<DeploymentMonitorSyncSnapshot>,
): TodoStatus | null {
  const deploymentMonitors = monitors.filter(
    (monitor) => monitor.type === MonitorType.DEPLOYMENT,
  );
  const latest = findLatestSuccessfulDeploymentMonitor(deploymentMonitors);
  if (!latest?.lastResult) return null;

  return resolveTodoStatusFromSuccessfulDeployPoll(
    latest.lastResult,
    latest.type,
    latest.config,
    currentStatus,
    pullRequests,
  );
}
