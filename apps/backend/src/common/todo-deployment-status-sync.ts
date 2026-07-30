import {
  DeployedEnvironmentName,
  MonitorResultStatus,
  MonitorType,
  TodoStatus,
  type DeploymentMonitorConfig,
  type MonitorResult,
} from '@todo-platform/shared-types';
import { isDeploymentMonitorPollError } from './monitor-poll-error';

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
): TodoStatus | null {
  if (newResult.status !== MonitorResultStatus.SUCCESS) return null;

  const targetStatus = resolveDeploySuccessTargetStatus(type, config);
  if (!targetStatus) return null;

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

/** Highest target status implied by any successful deployment monitor on the todo. */
export function reconcileTodoStatusFromDeploymentMonitors(
  currentStatus: TodoStatus,
  pullRequests: ReadonlyArray<{ status: string }>,
  monitors: ReadonlyArray<{
    type: string;
    config: unknown;
    lastResult: MonitorResult | null;
  }>,
): TodoStatus | null {
  let best: TodoStatus | null = null;

  for (const monitor of monitors) {
    if (monitor.type !== MonitorType.DEPLOYMENT) continue;
    const lastResult = monitor.lastResult;
    if (!lastResult || lastResult.status !== MonitorResultStatus.SUCCESS) continue;

    const candidate = resolveTodoStatusFromSuccessfulDeployPoll(
      lastResult,
      monitor.type,
      monitor.config,
      currentStatus,
      pullRequests,
    );
    if (!candidate) continue;
    if (!best || todoStatusRank(candidate) > todoStatusRank(best)) {
      best = candidate;
    }
  }

  return best;
}
