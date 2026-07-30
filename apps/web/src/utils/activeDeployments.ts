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
  currentStep?: string | null;
  durationMs: number | null;
  timestamp?: number;
  buildUrl?: string;
  sortKey: number;
  deploymentTimeMs: number;
};

export type ServiceDeploymentGroup = {
  serviceKey: string;
  serviceLabel: string;
  deployments: ActiveDeploymentRow[];
  maxSortKey: number;
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
    id: `${serviceKey}:${env.name}`,
    serviceKey,
    serviceLabel: serviceLabelForTodo(todo),
    environment: env.name,
    status: deployment.status,
    buildNumber: deployment.buildNumber,
    currentStep: deployment.currentStep,
    durationMs: deployment.durationMs,
    timestamp: deployment.timestamp,
    buildUrl: deployment.buildUrl,
    sortKey: sortKeyForEnv(env),
    deploymentTimeMs,
  };
}

function upsertLatestByServiceEnv(
  rowsByServiceEnv: Map<string, ActiveDeploymentRow>,
  row: ActiveDeploymentRow,
): void {
  const key = `${row.serviceKey}:${row.environment}`;
  const existing = rowsByServiceEnv.get(key);
  if (!existing || row.sortKey > existing.sortKey) {
    rowsByServiceEnv.set(key, row);
  }
}

export function collectTodayServiceDeployments(
  todos: TodoDto[],
  nowMs: number = Date.now(),
): ActiveDeploymentRow[] {
  const rowsByServiceEnv = new Map<string, ActiveDeploymentRow>();

  for (const todo of todos) {
    for (const env of todo.deployedEnvironments ?? []) {
      const row = rowFromEnv(todo, env);
      if (row && isDeploymentToday(row.deploymentTimeMs, nowMs)) {
        upsertLatestByServiceEnv(rowsByServiceEnv, row);
      }
    }

    for (const subtask of todo.subtasks ?? []) {
      for (const env of subtask.deployedEnvironments ?? []) {
        const row = rowFromEnv(todo, env);
        if (row && isDeploymentToday(row.deploymentTimeMs, nowMs)) {
          upsertLatestByServiceEnv(rowsByServiceEnv, row);
        }
      }
    }
  }

  return [...rowsByServiceEnv.values()].sort((a, b) => b.sortKey - a.sortKey);
}

export function groupTodayDeploymentsByService(
  rows: ActiveDeploymentRow[],
): ServiceDeploymentGroup[] {
  const groups = new Map<string, ServiceDeploymentGroup>();

  for (const row of rows) {
    const existing = groups.get(row.serviceKey);
    if (!existing) {
      groups.set(row.serviceKey, {
        serviceKey: row.serviceKey,
        serviceLabel: row.serviceLabel,
        deployments: [row],
        maxSortKey: row.sortKey,
      });
      continue;
    }

    existing.deployments.push(row);
    existing.maxSortKey = Math.max(existing.maxSortKey, row.sortKey);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      deployments: [...group.deployments].sort((a, b) => b.sortKey - a.sortKey),
    }))
    .sort((a, b) => b.maxSortKey - a.maxSortKey);
}

/** @deprecated Use collectTodayServiceDeployments */
export const collectActiveDeployments = collectTodayServiceDeployments;
