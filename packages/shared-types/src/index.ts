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
  DEPLOYMENT_DISCOVERY = 'deployment_discovery',
  TESTCASE_SCAN = 'testcase_scan',
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

export enum TestcaseScanStatus {
  SCANNING = 'scanning',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ScanJobInfo {
  jobName: string;
  buildNumber: number;
  durationMs: number | null;
  status: DeploymentStatus;
  buildUrl?: string;
  timestamp?: number;
}

export interface DeploymentInfo {
  env: DeployedEnvironmentName | 'prod';
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

export enum AssociatedTicketType {
  FEATURE = 'feature',
  BUG = 'bug',
}

export interface AssociatedTicketDto {
  id: string;
  title: string;
  type: AssociatedTicketType;
  link: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssociatedTicketInput {
  title: string;
  type: AssociatedTicketType;
  link: string;
}

export interface TestcaseScanDto {
  id: string;
  todoId: string;
  name: string;
  status: TestcaseScanStatus;
  jobUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestcaseScanInput {
  name: string;
  status?: TestcaseScanStatus;
  jobUrl?: string | null;
}

export type ServiceDeploymentEnvironment = DeployedEnvironmentName | 'prod';

export interface ServiceDeploymentLastBuildPreviewDto {
  buildNumber: number;
  status: DeploymentStatus;
  buildUrl?: string;
  durationMs: number | null;
  timestamp?: number;
}

export interface ServiceDeploymentValidationPreviewDto {
  jobName: string;
  normalizedJobUrl: string;
  lastBuild?: ServiceDeploymentLastBuildPreviewDto | null;
}

export interface ServiceDeploymentDto {
  id: string;
  serviceId: string;
  environment: ServiceDeploymentEnvironment;
  jobUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceDeploymentWriteResponseDto {
  deployment: ServiceDeploymentDto;
  validation: ServiceDeploymentValidationPreviewDto;
}

export interface CreateServiceDeploymentDto {
  environment: ServiceDeploymentEnvironment;
  jobUrl: string;
}

export interface UpdateServiceDeploymentDto {
  jobUrl: string;
}

export interface ServiceDto {
  id: string;
  keyName: string;
  displayName: string;
  deployments: ServiceDeploymentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceDto {
  keyName: string;
  displayName?: string;
}

export interface UpdateServiceDto {
  displayName?: string | null;
}

export interface TodoDto {
  id: string;
  title: string;
  description: string | null;
  changelog: string | null;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
  service?: ServiceDto | null;
  monitor?: MonitorDto | null;
  subtasks?: SubtaskDto[];
  pullRequests?: AssociatedPullRequestDto[];
  deployedEnvironments?: DeployedEnvironmentDto[];
  associatedTickets?: AssociatedTicketDto[];
  testcaseScanHistory?: TestcaseScanDto[];
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
  releaseDeploymentId: string | null;
  releaseId: string | null;
  testcaseScanId: string | null;
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
  changelog?: string;
  status?: TodoStatus;
  serviceId?: string | null;
  serviceKeyName?: string | null;
  monitor?: CreateMonitorDto;
  pullRequests?: AssociatedPullRequestInput[];
  deployedEnvironments?: DeployedEnvironmentName[];
  associatedTickets?: AssociatedTicketInput[];
  testcaseScanHistory?: TestcaseScanInput[];
}

export interface UpdateTodoDto {
  title?: string;
  description?: string;
  changelog?: string;
  status?: TodoStatus;
  serviceId?: string | null;
  serviceKeyName?: string | null;
  monitor?: UpdateMonitorDto;
  pullRequests?: AssociatedPullRequestInput[];
  deployedEnvironments?: DeployedEnvironmentName[];
  associatedTickets?: AssociatedTicketInput[];
  testcaseScanHistory?: TestcaseScanInput[];
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
  | 'monitor.deleted'
  | 'release.created'
  | 'release.updated';

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
  env: DeployedEnvironmentName | 'prod';
  jobUrl: string;
  buildNumber: number;
  /** When true, poll results enrich deployment chips but do not mutate TodoStatus. */
  suppressTodoStatusSync?: boolean;
}

export interface DeploymentDiscoveryPendingService {
  serviceId: string;
  catalogJobUrl: string;
}

export interface DeploymentDiscoverySkippedService {
  serviceId: string;
  reason: string;
}

export interface DeploymentDiscoveryMonitorConfig {
  releaseId: string;
  releaseCreatedAtMs: number;
  pendingServices: DeploymentDiscoveryPendingService[];
  skippedServices?: DeploymentDiscoverySkippedService[];
}

export interface TestcaseScanMonitorConfig {
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

export enum ReleaseType {
  STAGING = 'staging',
  PROD = 'prod',
}

export enum ReleaseStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  SUCCESSFUL = 'successful',
  PARTIAL_SUCCESS = 'partial_success',
  FAILED = 'failed',
}

export enum ReleaseDeploymentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
}

export interface ReleaseMemberSummaryDto {
  todoId: string;
  title: string;
  serviceId: string | null;
  serviceKeyName: string | null;
  archived: boolean;
}

export interface ReleaseDeploymentDto {
  id: string;
  releaseId: string;
  serviceId: string;
  serviceKeyName: string;
  environment: ReleaseType;
  jobUrl: string | null;
  buildNumber: number | null;
  status: ReleaseDeploymentStatus;
  monitor?: MonitorDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseDto {
  id: string;
  releaseDate: string;
  content: string;
  type: ReleaseType;
  status: ReleaseStatus;
  members: ReleaseMemberSummaryDto[];
  deployments: ReleaseDeploymentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseDeploymentInput {
  serviceId?: string;
  serviceKeyName?: string;
  jobUrl: string;
  buildNumber: number;
}

export interface CreateReleaseDto {
  type: ReleaseType;
  releaseDate: string;
  content: string;
  todoIds: string[];
  deployments?: ReleaseDeploymentInput[];
}

export interface UpdateReleaseDto {
  content?: string;
  todoIdsToAdd?: string[];
  todoIdsToRemove?: string[];
  deployments?: ReleaseDeploymentInput[];
  /** Manual status override. Setting successful completes/archives all member todos. */
  status?: ReleaseStatus;
}

export interface ListTodosParams {
  status?: TodoStatus;
  serviceId?: string;
  serviceKeyName?: string;
  availableForRelease?: boolean;
}
