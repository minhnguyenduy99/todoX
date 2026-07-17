export enum TodoStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  TESTING = 'TESTING',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
}

export enum SubtaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  TESTING = 'TESTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum MonitorType {
  HTTP = 'http',
  GITHUB_PR = 'github_pr',
  DEPLOYMENT = 'deployment',
}

export enum MonitorResultStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  RUNNING = 'running',
}

export interface MonitorResult {
  status: MonitorResultStatus;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface MonitorProvider {
  type: string;
  check(config: unknown): Promise<MonitorResult>;
}

export interface TodoDto {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
  subtasks?: SubtaskDto[];
}

export interface SubtaskDto {
  id: string;
  todoId: string;
  name: string;
  status: SubtaskStatus;
  createdAt: string;
  updatedAt: string;
  monitor?: MonitorDto | null;
}

export interface MonitorDto {
  id: string;
  subtaskId: string;
  type: MonitorType;
  cron: string;
  enabled: boolean;
  config: Record<string, unknown>;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: MonitorResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoDto {
  title: string;
  description?: string;
  status?: TodoStatus;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string;
  status?: TodoStatus;
}

export interface CreateSubtaskDto {
  name: string;
  status?: SubtaskStatus;
  monitor?: CreateMonitorDto;
}

export interface UpdateSubtaskDto {
  name?: string;
  status?: SubtaskStatus;
  monitor?: UpdateMonitorDto;
}

export interface CreateMonitorDto {
  type: MonitorType;
  cron: string;
  enabled?: boolean;
  config: Record<string, unknown>;
}

export interface UpdateMonitorDto {
  type?: MonitorType;
  cron?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export type WebSocketEventType =
  | 'todo.created'
  | 'todo.updated'
  | 'todo.deleted'
  | 'subtask.created'
  | 'subtask.updated'
  | 'subtask.deleted'
  | 'monitor.created'
  | 'monitor.updated'
  | 'monitor.deleted';

export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
}

export interface HttpMonitorConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  expectedStatus?: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface GitHubPrMonitorConfig {
  owner: string;
  repo: string;
  pullNumber: number;
}

export interface DeploymentMonitorConfig {
  url: string;
  method?: 'GET' | 'POST';
  expectedStatus?: number;
  deploymentId?: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}
