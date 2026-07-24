import {
  type DeployedEnvironmentDto,
  type DeployedEnvironmentName,
  type TodoDto,
} from '@todo-platform/shared-types';
import type { DeploymentStatus } from '@todo-platform/shared-types';
import { getDeploymentSortKey } from './deploymentSort';

export type ActiveDeploymentRow = {
  id: string;
  serviceKey: string;
  serviceLabel: string;
  environment: DeployedEnvironmentName;
  status: DeploymentStatus;
  buildNumber: number;
  durationMs: number | null;
  timestamp?: number;
  buildUrl?: string;
  sortKey: number;
  deploymentTimeMs: number;
};

function serviceLabelForTodo(todo: TodoDto): string {
  return todo.service?.displayName ?? 'Unassigned';
}

function serviceKeyForTodo(todo: TodoDto): string {
  return todo.service?.keyName ?? 'unassigned';
}

function sortKeyForEnv(env: DeployedEnvironmentDto): number {
  return getDeploymentSortKey(env) ?? Date.parse(env.updatedAt) ?? 0;
}

export function getDeploymentTimeMs(env: DeployedEnvironmentDto): number | null {
  if (!env.deployment) return null;

  if (typeof env.deployment.timestamp === 'number') {
    return env.deployment.timestamp;
  }

  const updatedAt = Date.parse(env.updatedAt);
  return Number.isNaN(updatedAt) ? null : updatedAt;
}

export function startOfLocalDayMs(referenceMs: number): number {
  const date = new Date(referenceMs);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function endOfLocalDayMs(referenceMs: number): number {
  return startOfLocalDayMs(referenceMs) + 24 * 60 * 60 * 1000 - 1;
}

export function isDeploymentToday(deploymentTimeMs: number, nowMs: number): boolean {
  return (
    deploymentTimeMs >= startOfLocalDayMs(nowMs) &&
    deploymentTimeMs <= endOfLocalDayMs(nowMs)
  );
}

function rowFromEnv(todo: TodoDto, env: DeployedEnvironmentDto): ActiveDeploymentRow | null {
  const deployment = env.deployment;
  if (!deployment) return null;

  const deploymentTimeMs = getDeploymentTimeMs(env);
  if (deploymentTimeMs === null) return null;

  const serviceKey = serviceKeyForTodo(todo);

  return {
    id: serviceKey,
    serviceKey,
    serviceLabel: serviceLabelForTodo(todo),
    environment: env.name,
    status: deployment.status,
    buildNumber: deployment.buildNumber,
    durationMs: deployment.durationMs,
    timestamp: deployment.timestamp,
    buildUrl: deployment.buildUrl,
    sortKey: sortKeyForEnv(env),
    deploymentTimeMs,
  };
}

function upsertLatestByService(
  rowsByService: Map<string, ActiveDeploymentRow>,
  row: ActiveDeploymentRow,
): void {
  const existing = rowsByService.get(row.serviceKey);
  if (!existing || row.sortKey > existing.sortKey) {
    rowsByService.set(row.serviceKey, row);
  }
}

export function collectTodayServiceDeployments(
  todos: TodoDto[],
  nowMs: number = Date.now(),
): ActiveDeploymentRow[] {
  const rowsByService = new Map<string, ActiveDeploymentRow>();

  for (const todo of todos) {
    for (const env of todo.deployedEnvironments ?? []) {
      const row = rowFromEnv(todo, env);
      if (row && isDeploymentToday(row.deploymentTimeMs, nowMs)) {
        upsertLatestByService(rowsByService, row);
      }
    }

    for (const subtask of todo.subtasks ?? []) {
      for (const env of subtask.deployedEnvironments ?? []) {
        const row = rowFromEnv(todo, env);
        if (row && isDeploymentToday(row.deploymentTimeMs, nowMs)) {
          upsertLatestByService(rowsByService, row);
        }
      }
    }
  }

  return [...rowsByService.values()].sort((a, b) => b.sortKey - a.sortKey);
}

/** @deprecated Use collectTodayServiceDeployments */
export const collectActiveDeployments = collectTodayServiceDeployments;
