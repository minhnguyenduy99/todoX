import {
  TodoStatus,
  SubtaskStatus,
  MonitorResultStatus,
  ReleaseStatus,
  type ReleaseDto,
  type TodoDto,
  type WebSocketEvent,
} from '@todo-platform/shared-types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export async function fetchTodos(): Promise<TodoDto[]> {
  const res = await fetch(`${API_BASE}/todos`);
  if (!res.ok) throw new Error(`Failed to fetch todos: ${res.status}`);
  return res.json();
}

export async function fetchReleases(): Promise<ReleaseDto[]> {
  const res = await fetch(`${API_BASE}/releases`);
  if (!res.ok) throw new Error(`Failed to fetch releases: ${res.status}`);
  return res.json();
}

export function getWsUrl(): string {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (wsUrl) return wsUrl;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function todoStatusColor(status: TodoStatus): string {
  switch (status) {
    case TodoStatus.NOT_STARTED:
      return 'badge-gray';
    case TodoStatus.IN_PROGRESS:
      return 'badge-blue';
    case TodoStatus.TESTING:
      return 'badge-yellow';
    case TodoStatus.WAIT_FOR_STAGING:
      return 'badge-purple';
    case TodoStatus.COMPLETED:
      return 'badge-green';
    default:
      return 'badge-gray';
  }
}

export function subtaskStatusColor(status: SubtaskStatus): string {
  switch (status) {
    case SubtaskStatus.NOT_STARTED:
      return 'badge-gray';
    case SubtaskStatus.IN_PROGRESS:
      return 'badge-blue';
    case SubtaskStatus.TESTING:
      return 'badge-yellow';
    case SubtaskStatus.COMPLETED:
      return 'badge-green';
    case SubtaskStatus.FAILED:
      return 'badge-red';
    default:
      return 'badge-gray';
  }
}

export function monitorResultColor(status: MonitorResultStatus | undefined): string {
  switch (status) {
    case MonitorResultStatus.SUCCESS:
      return 'badge-green';
    case MonitorResultStatus.FAILED:
      return 'badge-red';
    case MonitorResultStatus.RUNNING:
      return 'badge-blue';
    default:
      return 'badge-gray';
  }
}

export function releaseStatusColor(status: ReleaseStatus): string {
  switch (status) {
    case ReleaseStatus.SUCCESSFUL:
      return 'badge-green';
    case ReleaseStatus.FAILED:
      return 'badge-red';
    case ReleaseStatus.PARTIAL_SUCCESS:
      return 'badge-yellow';
    case ReleaseStatus.IN_PROGRESS:
      return 'badge-blue';
    default:
      return 'badge-gray';
  }
}

export function releaseStatusLabel(status: ReleaseStatus): string {
  return status.replaceAll('_', ' ');
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleString();
}

export type { WebSocketEvent, TodoDto, ReleaseDto };
