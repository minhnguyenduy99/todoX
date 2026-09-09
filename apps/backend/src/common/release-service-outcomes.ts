import { ReleaseDeploymentStatus, ReleaseType } from '@todo-platform/shared-types';
import {
  resolveServiceOutcomes,
  type ServiceMemberSnapshot,
} from './release-deployment-status-sync';

export type ReleaseOutcomeMember = {
  todoId: string;
  todo: {
    serviceId: string | null;
    status: string;
  };
};

export type ReleaseOutcomeInput = {
  type: string;
  members: ReleaseOutcomeMember[];
  deployments: Array<{ serviceId: string; status: string }>;
  completedTodos: Array<{ serviceId: string | null }>;
};

export type ReleaseServiceOutcomeClassification = {
  successfulServiceIds: string[];
  nonSuccessfulServiceIds: string[];
  movableTodoIds: string[];
  hasAnySuccessfulService: boolean;
};

export function classifyReleaseServiceOutcomes(
  release: ReleaseOutcomeInput,
): ReleaseServiceOutcomeClassification {
  const memberServiceIds = [
    ...new Set(
      [
        ...release.members
          .map((m) => m.todo.serviceId)
          .filter((id): id is string => id != null),
        ...release.completedTodos
          .map((c) => c.serviceId)
          .filter((id): id is string => id != null),
      ],
    ),
  ];

  const deploymentsByServiceId = new Map<string, ReleaseDeploymentStatus>(
    release.deployments.map((d) => [
      d.serviceId,
      d.status as ReleaseDeploymentStatus,
    ]),
  );

  const membersByServiceId = new Map<string, ServiceMemberSnapshot>();

  for (const member of release.members) {
    if (!member.todo.serviceId) continue;
    const snapshot = membersByServiceId.get(member.todo.serviceId) ?? {
      activeStatuses: [],
      archivedCount: 0,
    };
    snapshot.activeStatuses.push(member.todo.status);
    membersByServiceId.set(member.todo.serviceId, snapshot);
  }

  for (const archived of release.completedTodos) {
    if (!archived.serviceId) continue;
    const snapshot = membersByServiceId.get(archived.serviceId) ?? {
      activeStatuses: [],
      archivedCount: 0,
    };
    snapshot.archivedCount += 1;
    membersByServiceId.set(archived.serviceId, snapshot);
  }

  const outcomes = resolveServiceOutcomes({
    releaseType:
      String(release.type) === ReleaseType.PROD
        ? ReleaseType.PROD
        : ReleaseType.STAGING,
    memberServiceIds,
    deploymentsByServiceId,
    membersByServiceId,
  });

  const successfulServiceIds: string[] = [];
  const nonSuccessfulServiceIds: string[] = [];

  for (const serviceId of memberServiceIds) {
    const outcome = outcomes.get(serviceId);
    if (outcome === ReleaseDeploymentStatus.SUCCESSFUL) {
      successfulServiceIds.push(serviceId);
    } else {
      nonSuccessfulServiceIds.push(serviceId);
    }
  }

  const nonSuccessfulSet = new Set(nonSuccessfulServiceIds);
  const movableTodoIds = release.members
    .filter(
      (member) =>
        member.todo.serviceId != null &&
        nonSuccessfulSet.has(member.todo.serviceId),
    )
    .map((member) => member.todoId);

  return {
    successfulServiceIds,
    nonSuccessfulServiceIds,
    movableTodoIds,
    hasAnySuccessfulService: successfulServiceIds.length > 0,
  };
}
