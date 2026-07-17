import type { TodoApiClient } from '@todo-platform/shared-api';
import {
  DEPLOYED_ENVIRONMENT_ORDER,
  DeployedEnvironmentName,
  type DeployedEnvironmentDto,
  type SubtaskDto,
  type TodoDto,
} from '@todo-platform/shared-types';

export const deployedEnvironmentSchema = {
  type: 'string' as const,
  enum: Object.values(DeployedEnvironmentName),
  description: 'Deployment environment name',
};

export function toDeployedEnvironmentName(
  env: DeployedEnvironmentDto,
): DeployedEnvironmentName {
  return env.name;
}

export function mergeDeployedEnvironment(
  existing: DeployedEnvironmentName[],
  incoming: DeployedEnvironmentName,
): DeployedEnvironmentName[] {
  if (existing.includes(incoming)) {
    return existing;
  }
  return sortDeployedEnvironmentNames([...existing, incoming]);
}

export function sortDeployedEnvironmentNames(
  names: DeployedEnvironmentName[],
): DeployedEnvironmentName[] {
  return [...names].sort(
    (a, b) =>
      DEPLOYED_ENVIRONMENT_ORDER.indexOf(a) - DEPLOYED_ENVIRONMENT_ORDER.indexOf(b),
  );
}

export function resolveCreateDeployedEnvironments(
  args: Record<string, unknown>,
): DeployedEnvironmentName[] | undefined {
  if (args.deployedEnvironments !== undefined) {
    return args.deployedEnvironments as DeployedEnvironmentName[];
  }

  if (args.deployedEnvironment !== undefined) {
    return [args.deployedEnvironment as DeployedEnvironmentName];
  }

  return undefined;
}

export async function resolveUpdateDeployedEnvironments(
  api: TodoApiClient,
  scope: { todoId: string } | { todoId: string; subtaskId: string },
  args: Record<string, unknown>,
): Promise<DeployedEnvironmentName[] | undefined> {
  if (args.deployedEnvironments !== undefined) {
    return args.deployedEnvironments as DeployedEnvironmentName[];
  }

  if (args.deployedEnvironment === undefined) {
    return undefined;
  }

  const incoming = args.deployedEnvironment as DeployedEnvironmentName;
  const existing = await loadExistingDeployedEnvironments(api, scope);
  return mergeDeployedEnvironment(existing, incoming);
}

async function loadExistingDeployedEnvironments(
  api: TodoApiClient,
  scope: { todoId: string } | { todoId: string; subtaskId: string },
): Promise<DeployedEnvironmentName[]> {
  const todo = await api.getTodo(scope.todoId);

  if ('subtaskId' in scope) {
    const subtask = findSubtask(todo, scope.subtaskId);
    return (subtask.deployedEnvironments ?? []).map(toDeployedEnvironmentName);
  }

  return (todo.deployedEnvironments ?? []).map(toDeployedEnvironmentName);
}

function findSubtask(todo: TodoDto, subtaskId: string): SubtaskDto {
  const subtask = todo.subtasks?.find((item: SubtaskDto) => item.id === subtaskId);
  if (!subtask) {
    throw new Error(`Subtask not found: ${subtaskId}`);
  }
  return subtask;
}

export async function addDeployedEnvironment(
  api: TodoApiClient,
  args: Record<string, unknown>,
): Promise<TodoDto | SubtaskDto> {
  const todoId = args.todoId as string;
  const subtaskId = args.subtaskId as string | undefined;
  const incoming = args.environment as DeployedEnvironmentName;

  if (subtaskId) {
    const existing = await loadExistingDeployedEnvironments(api, { todoId, subtaskId });
    return api.updateSubtask(todoId, subtaskId, {
      deployedEnvironments: mergeDeployedEnvironment(existing, incoming),
    });
  }

  const existing = await loadExistingDeployedEnvironments(api, { todoId });
  return api.updateTodo(todoId, {
    deployedEnvironments: mergeDeployedEnvironment(existing, incoming),
  });
}
