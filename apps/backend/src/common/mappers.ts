import {
  MonitorResultStatus,
  MonitorType,
  SubtaskStatus,
  TodoStatus,
  DeployedEnvironmentName,
  AssociatedTicketType,
  ReleaseDeploymentStatus,
  ReleaseStatus,
  ReleaseType,
  type AssociatedPullRequestDto,
  type AssociatedTicketDto,
  type DeployedEnvironmentDto,
  type MonitorDto,
  type MonitorResult,
  type ReleaseDeploymentDto,
  type ReleaseDto,
  type ReleaseMemberSummaryDto,
  type ServiceDto,
  type SubtaskDto,
  type TodoDto,
} from '@todo-platform/shared-types';
import type {
  AssociatedPullRequest,
  AssociatedTicket,
  CompletedTodo,
  DeployedEnvironment,
  Monitor,
  Release,
  ReleaseDeployment,
  Service,
  Subtask,
  Todo,
} from '@prisma/client';
import {
  collectDeploymentMonitors,
  enrichDeployedEnvironments,
} from './deployment-enrichment';

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
    todoId: monitor.todoId,
    subtaskId: monitor.subtaskId,
    releaseDeploymentId: monitor.releaseDeploymentId ?? null,
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

export function toAssociatedTicketDto(
  ticket: AssociatedTicket,
): AssociatedTicketDto {
  return {
    id: ticket.id,
    title: ticket.title,
    type: ticket.type as AssociatedTicketType,
    link: ticket.link,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export function toServiceDto(service: Service): ServiceDto {
  return {
    id: service.id,
    keyName: service.keyName,
    displayName: service.displayName ?? service.keyName,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
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
): Omit<DeployedEnvironmentDto, 'deployment'> {
  return {
    id: env.id,
    name: apiNameByPrismaName[env.name],
    createdAt: env.createdAt.toISOString(),
    updatedAt: env.updatedAt.toISOString(),
  };
}

function enrichSubtaskDeployedEnvironments(
  environments: DeployedEnvironment[] | undefined,
  monitor: Monitor | null | undefined,
): DeployedEnvironmentDto[] | undefined {
  if (!environments) return undefined;
  const monitorDto = monitor ? toMonitorDto(monitor) : null;
  const monitors = collectDeploymentMonitors([monitorDto]);
  return enrichDeployedEnvironments(environments, monitors, toDeployedEnvironmentDto);
}

function enrichTodoDeployedEnvironments(
  environments: DeployedEnvironment[] | undefined,
  subtasks: Array<Subtask & { monitor?: Monitor | null }> | undefined,
  todoMonitor?: Monitor | null,
): DeployedEnvironmentDto[] | undefined {
  if (!environments) return undefined;
  const monitors = collectDeploymentMonitors([
    todoMonitor ? toMonitorDto(todoMonitor) : null,
    ...(subtasks ?? []).map((subtask) =>
      subtask.monitor ? toMonitorDto(subtask.monitor) : null,
    ),
  ]);
  return enrichDeployedEnvironments(environments, monitors, toDeployedEnvironmentDto);
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
    deployedEnvironments: enrichSubtaskDeployedEnvironments(
      subtask.deployedEnvironments,
      subtask.monitor,
    ),
  };
}

export function toTodoDto(
  todo: Todo & {
    monitor?: Monitor | null;
    service?: Service | null;
    subtasks?: (Subtask & {
      monitor?: Monitor | null;
      pullRequests?: AssociatedPullRequest[];
      deployedEnvironments?: DeployedEnvironment[];
    })[];
    pullRequests?: AssociatedPullRequest[];
    associatedTickets?: AssociatedTicket[];
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
    service: todo.service ? toServiceDto(todo.service) : null,
    monitor: todo.monitor ? toMonitorDto(todo.monitor) : null,
    subtasks: todo.subtasks?.map(toSubtaskDto),
    pullRequests: todo.pullRequests?.map(toAssociatedPullRequestDto),
    associatedTickets: todo.associatedTickets?.map(toAssociatedTicketDto),
    deployedEnvironments: enrichTodoDeployedEnvironments(
      todo.deployedEnvironments,
      todo.subtasks,
      todo.monitor,
    ),
  };
}

export function toReleaseDeploymentDto(
  deployment: ReleaseDeployment & {
    service: Service;
    monitor?: Monitor | null;
  },
): ReleaseDeploymentDto {
  return {
    id: deployment.id,
    releaseId: deployment.releaseId,
    serviceId: deployment.serviceId,
    serviceKeyName: deployment.service.keyName,
    environment: deployment.environment as ReleaseType,
    jobUrl: deployment.jobUrl,
    buildNumber: deployment.buildNumber,
    status: deployment.status as ReleaseDeploymentStatus,
    monitor: deployment.monitor ? toMonitorDto(deployment.monitor) : null,
    createdAt: deployment.createdAt.toISOString(),
    updatedAt: deployment.updatedAt.toISOString(),
  };
}

export function toReleaseDto(
  release: Release & {
    members: Array<{
      todoId: string;
      todo: Todo & { service?: Service | null };
    }>;
    deployments: Array<
      ReleaseDeployment & { service: Service; monitor?: Monitor | null }
    >;
    completedTodos?: Array<
      CompletedTodo & { service?: Service | null }
    >;
  },
): ReleaseDto {
  const activeMembers: ReleaseMemberSummaryDto[] = release.members.map((member) => ({
    todoId: member.todoId,
    title: member.todo.title,
    serviceId: member.todo.serviceId,
    serviceKeyName: member.todo.service?.keyName ?? null,
    archived: false,
  }));

  const archivedMembers: ReleaseMemberSummaryDto[] = (release.completedTodos ?? []).map(
    (archived) => ({
      todoId: archived.originalTodoId,
      title: archived.title,
      serviceId: archived.serviceId,
      serviceKeyName: archived.service?.keyName ?? null,
      archived: true,
    }),
  );

  const seen = new Set(activeMembers.map((m) => m.todoId));
  const members = [
    ...activeMembers,
    ...archivedMembers.filter((m) => !seen.has(m.todoId)),
  ];

  return {
    id: release.id,
    releaseDate: release.releaseDate,
    content: release.content,
    type: release.type as ReleaseType,
    status: release.status as ReleaseStatus,
    members,
    deployments: release.deployments.map(toReleaseDeploymentDto),
    createdAt: release.createdAt.toISOString(),
    updatedAt: release.updatedAt.toISOString(),
  };
}

