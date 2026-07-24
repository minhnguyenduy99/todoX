import { DeploymentStatus } from '@todo-platform/shared-types';

export function formatDeploymentDuration(durationMs: number | null): string | null {
  if (durationMs === null || durationMs <= 0) return null;
  if (durationMs < 60_000) return `${Math.round(durationMs / 1000)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function resolveDeploymentDurationMs(
  durationMs: number | null,
  status: DeploymentStatus,
  timestamp?: number,
  nowMs: number = Date.now(),
): number | null {
  if (durationMs !== null && durationMs > 0) return durationMs;
  if (
    status === DeploymentStatus.IN_PROGRESS &&
    typeof timestamp === 'number' &&
    timestamp > 0
  ) {
    return Math.max(0, nowMs - timestamp);
  }
  return null;
}
