export enum TodoStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  TESTING = 'TESTING',
  WAIT_FOR_STAGING = 'WAIT_FOR_STAGING',
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

export enum DeployedEnvironmentName {
  DEV = 'dev',
  UAT = 'uat',
  UAT_MAIN = 'uat-main',
  STAGING = 'staging',
}

export const DEPLOYED_ENVIRONMENT_ORDER: DeployedEnvironmentName[] = [
  DeployedEnvironmentName.DEV,
  DeployedEnvironmentName.UAT,
  DeployedEnvironmentName.UAT_MAIN,
  DeployedEnvironmentName.STAGING,
];

export enum DeploymentStatus {
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAIL = 'fail',
}

export interface DeploymentInfo {
  env: DeployedEnvironmentName;
  jobName: string;
  buildNumber: number;
  durationMs: number | null;
  status: DeploymentStatus;
  buildUrl?: string;
  timestamp?: number;
}

export interface DeployedEnvironmentDto {
  id: string;
  name: DeployedEnvironmentName;
  createdAt: string;
  updatedAt: string;
  deployment?: DeploymentInfo;
}

export interface AssociatedPullRequestDto {
  id: string;
  number: number;
  title: string;
  status: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssociatedPullRequestInput {
  number: number;
  title: string;
  status: string;
  url: string;
}

export interface TodoDto {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
  monitor?: MonitorDto | null;
  subtasks?: SubtaskDto[];
  pullRequests?: AssociatedPullRequestDto[];
  deployedEnvironments?: DeployedEnvironmentDto[];
}

export interface SubtaskDto {
  id: string;
  todoId: string;
  name: string;
  status: SubtaskStatus;
  createdAt: string;
  updatedAt: string;
  monitor?: MonitorDto | null;
  pullRequests?: AssociatedPullRequestDto[];
  deployedEnvironments?: DeployedEnvironmentDto[];
}

export interface MonitorDto {
  id: string;
  todoId: string | null;
  subtaskId: string | null;
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
  monitor?: CreateMonitorDto;
  pullRequests?: AssociatedPullRequestInput[];
  deployedEnvironments?: DeployedEnvironmentName[];
}

export interface UpdateTodoDto {
  title?: string;
  description?: string;
  status?: TodoStatus;
  monitor?: UpdateMonitorDto;
  pullRequests?: AssociatedPullRequestInput[];
  deployedEnvironments?: DeployedEnvironmentName[];
}

export interface CreateSubtaskDto {
  name: string;
  status?: SubtaskStatus;
  monitor?: CreateMonitorDto;
  pullRequests?: AssociatedPullRequestInput[];
  deployedEnvironments?: DeployedEnvironmentName[];
}

export interface UpdateSubtaskDto {
  name?: string;
  status?: SubtaskStatus;
  monitor?: UpdateMonitorDto;
  pullRequests?: AssociatedPullRequestInput[];
  deployedEnvironments?: DeployedEnvironmentName[];
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
  env: DeployedEnvironmentName;
  jobUrl: string;
  buildNumber: number;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}
