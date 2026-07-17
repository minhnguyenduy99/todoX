import {
  MonitorResultStatus,
  MonitorType,
  SubtaskStatus,
  TodoStatus,
  type AssociatedPullRequestDto,
  type MonitorDto,
  type MonitorResult,
  type SubtaskDto,
  type TodoDto,
} from '@todo-platform/shared-types';
import type { AssociatedPullRequest, Monitor, Subtask, Todo } from '@prisma/client';

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

export function toSubtaskDto(
  subtask: Subtask & {
    monitor?: Monitor | null;
    pullRequests?: AssociatedPullRequest[];
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
  };
}

export function toTodoDto(
  todo: Todo & {
    subtasks?: (Subtask & {
      monitor?: Monitor | null;
      pullRequests?: AssociatedPullRequest[];
    })[];
    pullRequests?: AssociatedPullRequest[];
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
  };
}
