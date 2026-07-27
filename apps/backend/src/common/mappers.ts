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
  type ServiceDeploymentEnvironment,
  type AssociatedPullRequestDto,
  type AssociatedTicketDto,
  type DeployedEnvironmentDto,
  type MonitorDto,
  type MonitorResult,
  type ReleaseDeploymentDto,
  type ReleaseDto,
  type ReleaseMemberSummaryDto,
  type ServiceDeploymentDto,
  type ServiceDto,
  type SubtaskDto,
  type TestcaseScanDto,
  type TodoDto,
  TestcaseScanStatus,
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
  ServiceDeployment,
  Subtask,
  TestcaseScan,
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
    releaseId: monitor.releaseId ?? null,
    testcaseScanId: monitor.testcaseScanId ?? null,
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

export function toServiceDeploymentDto(
  deployment: ServiceDeployment,
): ServiceDeploymentDto {
  return {
    id: deployment.id,
    serviceId: deployment.serviceId,
    environment: deployment.environment as ServiceDeploymentEnvironment,
    jobUrl: deployment.jobUrl,
    createdAt: deployment.createdAt.toISOString(),
    updatedAt: deployment.updatedAt.toISOString(),
  };
}

type ServiceWithDeployments = Service & { deployments?: ServiceDeployment[] };

export function toServiceDto(service: ServiceWithDeployments): ServiceDto {
  return {
    id: service.id,
    keyName: service.keyName,
    displayName: service.displayName ?? service.keyName,
    deployments: (service.deployments ?? []).map(toServiceDeploymentDto),
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

function pickPrimaryDeploymentMonitor(monitors: Monitor[]): Monitor | null {
  const deploymentMonitors = monitors.filter(
    (monitor) => monitor.type === MonitorType.DEPLOYMENT,
  );
  if (deploymentMonitors.length === 0) return null;

  return deploymentMonitors.reduce<Monitor | null>((latest, current) => {
    if (!latest) return current;
    const latestRun = latest.lastRunAt?.getTime() ?? 0;
    const currentRun = current.lastRunAt?.getTime() ?? 0;
    return currentRun >= latestRun ? current : latest;
  }, null);
}

function enrichSubtaskDeployedEnvironments(
  environments: DeployedEnvironment[] | undefined,
  monitors: Monitor[] | undefined,
): DeployedEnvironmentDto[] | undefined {
  if (!environments) return undefined;
  const monitorDtos = collectDeploymentMonitors(
    (monitors ?? []).map((monitor) => toMonitorDto(monitor)),
  );
  return enrichDeployedEnvironments(environments, monitorDtos, toDeployedEnvironmentDto);
}

function enrichTodoDeployedEnvironments(
  environments: DeployedEnvironment[] | undefined,
  subtasks: Array<Subtask & { monitors?: Monitor[] }> | undefined,
  todoMonitors: Monitor[] | undefined,
): DeployedEnvironmentDto[] | undefined {
  if (!environments) return undefined;
  const monitors = collectDeploymentMonitors([
    ...(todoMonitors ?? []).map((monitor) => toMonitorDto(monitor)),
    ...(subtasks ?? []).flatMap((subtask) =>
      (subtask.monitors ?? []).map((monitor) => toMonitorDto(monitor)),
    ),
  ]);
  return enrichDeployedEnvironments(environments, monitors, toDeployedEnvironmentDto);
}

export function toTestcaseScanDto(scan: TestcaseScan): TestcaseScanDto {
  return {
    id: scan.id,
    todoId: scan.todoId,
    name: scan.name,
    status: scan.status as TestcaseScanStatus,
    jobUrl: scan.jobUrl,
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
  };
}

export function toSubtaskDto(
  subtask: Subtask & {
    monitors?: Monitor[];
    pullRequests?: AssociatedPullRequest[];
    deployedEnvironments?: DeployedEnvironment[];
  },
): SubtaskDto {
  const monitors = subtask.monitors ?? [];
  const monitorDtos = monitors.map(toMonitorDto);
  const primaryMonitor = pickPrimaryDeploymentMonitor(monitors);

  return {
    id: subtask.id,
    todoId: subtask.todoId,
    name: subtask.name,
    status: subtask.status as SubtaskStatus,
    createdAt: subtask.createdAt.toISOString(),
    updatedAt: subtask.updatedAt.toISOString(),
    monitors: monitorDtos,
    monitor: primaryMonitor ? toMonitorDto(primaryMonitor) : null,
    pullRequests: subtask.pullRequests?.map(toAssociatedPullRequestDto),
    deployedEnvironments: enrichSubtaskDeployedEnvironments(
      subtask.deployedEnvironments,
      monitors,
    ),
  };
}

export function toTodoDto(
  todo: Todo & {
    monitors?: Monitor[];
    service?: Service | null;
    subtasks?: (Subtask & {
      monitors?: Monitor[];
      pullRequests?: AssociatedPullRequest[];
      deployedEnvironments?: DeployedEnvironment[];
    })[];
    pullRequests?: AssociatedPullRequest[];
    associatedTickets?: AssociatedTicket[];
    deployedEnvironments?: DeployedEnvironment[];
    testcaseScans?: TestcaseScan[];
  },
): TodoDto {
  const testcaseScanHistory = todo.testcaseScans
    ?.map(toTestcaseScanDto)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const todoMonitors = todo.monitors ?? [];
  const monitorDtos = todoMonitors.map(toMonitorDto);
  const primaryMonitor = pickPrimaryDeploymentMonitor(todoMonitors);

  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    changelog: todo.changelog,
    status: todo.status as TodoStatus,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
    service: todo.service ? toServiceDto(todo.service) : null,
    monitors: monitorDtos,
    monitor: primaryMonitor ? toMonitorDto(primaryMonitor) : null,
    subtasks: todo.subtasks?.map(toSubtaskDto),
    pullRequests: todo.pullRequests?.map(toAssociatedPullRequestDto),
    associatedTickets: todo.associatedTickets?.map(toAssociatedTicketDto),
    deployedEnvironments: enrichTodoDeployedEnvironments(
      todo.deployedEnvironments,
      todo.subtasks,
      todoMonitors,
    ),
    testcaseScanHistory,
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

