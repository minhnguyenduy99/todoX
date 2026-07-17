import {
  MonitorResultStatus,
  MonitorType,
  SubtaskStatus,
  TodoStatus,
  DeployedEnvironmentName,
  type AssociatedPullRequestDto,
  type DeployedEnvironmentDto,
  type MonitorDto,
  type MonitorResult,
  type SubtaskDto,
  type TodoDto,
} from '@todo-platform/shared-types';
import type {
  AssociatedPullRequest,
  DeployedEnvironment,
  Monitor,
  Subtask,
  Todo,
} from '@prisma/client';

export function toMonitorResult(value: unknown): MonitorResult | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (
    typeof obj.status !== 'string' ||
    typeof obj.message !== 'string'
  ) {
    return null;
  }
  return {
    status: obj.status as MonitorResultStatus,
    message: obj.message,
    metadata: obj.metadata as Record<string, unknown> | undefined,
  };
}

export function toMonitorDto(monitor: Monitor): MonitorDto {
  return {
    id: monitor.id,
    subtaskId: monitor.subtaskId,
    type: monitor.type as MonitorType,
    cron: monitor.cron,
    enabled: monitor.enabled,
    config: monitor.config as Record<string, unknown>,
    lastRunAt: monitor.lastRunAt?.toISOString() ?? null,
    nextRunAt: monitor.nextRunAt?.toISOString() ?? null,
    lastResult: toMonitorResult(monitor.lastResult),
    createdAt: monitor.createdAt.toISOString(),
    updatedAt: monitor.updatedAt.toISOString(),
  };
}

export function toAssociatedPullRequestDto(
  pr: AssociatedPullRequest,
): AssociatedPullRequestDto {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    status: pr.status,
    url: pr.url,
    createdAt: pr.createdAt.toISOString(),
    updatedAt: pr.updatedAt.toISOString(),
  };
}

const apiNameByPrismaName: Record<string, DeployedEnvironmentName> = {
  dev: DeployedEnvironmentName.DEV,
  uat: DeployedEnvironmentName.UAT,
  uat_main: DeployedEnvironmentName.UAT_MAIN,
  staging: DeployedEnvironmentName.STAGING,
};

export function toDeployedEnvironmentDto(
  env: DeployedEnvironment,
): DeployedEnvironmentDto {
  return {
    id: env.id,
    name: apiNameByPrismaName[env.name],
    createdAt: env.createdAt.toISOString(),
    updatedAt: env.updatedAt.toISOString(),
  };
}

export function toSubtaskDto(
  subtask: Subtask & {
    monitor?: Monitor | null;
    pullRequests?: AssociatedPullRequest[];
    deployedEnvironments?: DeployedEnvironment[];
  },
): SubtaskDto {
  return {
    id: subtask.id,
    todoId: subtask.todoId,
    name: subtask.name,
    status: subtask.status as SubtaskStatus,
    createdAt: subtask.createdAt.toISOString(),
    updatedAt: subtask.updatedAt.toISOString(),
    monitor: subtask.monitor ? toMonitorDto(subtask.monitor) : null,
    pullRequests: subtask.pullRequests?.map(toAssociatedPullRequestDto),
    deployedEnvironments: subtask.deployedEnvironments?.map(toDeployedEnvironmentDto),
  };
}

export function toTodoDto(
  todo: Todo & {
    subtasks?: (Subtask & {
      monitor?: Monitor | null;
      pullRequests?: AssociatedPullRequest[];
      deployedEnvironments?: DeployedEnvironment[];
    })[];
    pullRequests?: AssociatedPullRequest[];
    deployedEnvironments?: DeployedEnvironment[];
  },
): TodoDto {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    status: todo.status as TodoStatus,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
    subtasks: todo.subtasks?.map(toSubtaskDto),
    pullRequests: todo.pullRequests?.map(toAssociatedPullRequestDto),
    deployedEnvironments: todo.deployedEnvironments?.map(toDeployedEnvironmentDto),
  };
}
