import type { TodoApiClient } from '@todo-platform/shared-api';
import type {
  AssociatedPullRequestDto,
  AssociatedPullRequestInput,
  SubtaskDto,
  TodoDto,
} from '@todo-platform/shared-types';

export const pullRequestSchema = {
  type: 'object' as const,
  description: 'Associated pull request',
  properties: {
    number: { type: 'number', description: 'PR number' },
    title: { type: 'string', description: 'PR title' },
    status: {
      type: 'string',
      description: 'PR status (e.g. open, closed, merged, draft)',
    },
    url: { type: 'string', description: 'URL to the pull request' },
  },
  required: ['number', 'title', 'status', 'url'],
};

export function toPullRequestInput(
  pr: AssociatedPullRequestDto,
): AssociatedPullRequestInput {
  return {
    number: pr.number,
    title: pr.title,
    status: pr.status,
    url: pr.url,
  };
}

export function mergePullRequest(
  existing: AssociatedPullRequestInput[],
  incoming: AssociatedPullRequestInput,
): AssociatedPullRequestInput[] {
  if (existing.some((pr) => pr.number === incoming.number)) {
    return existing.map((pr) =>
      pr.number === incoming.number ? incoming : pr,
    );
  }
  return [...existing, incoming];
}

export function resolveCreatePullRequests(
  args: Record<string, unknown>,
): AssociatedPullRequestInput[] | undefined {
  if (args.pullRequests !== undefined) {
    return args.pullRequests as AssociatedPullRequestInput[];
  }

  if (args.pullRequest !== undefined) {
    return [args.pullRequest as AssociatedPullRequestInput];
  }

  return undefined;
}

export async function resolveUpdatePullRequests(
  api: TodoApiClient,
  scope: { todoId: string } | { todoId: string; subtaskId: string },
  args: Record<string, unknown>,
): Promise<AssociatedPullRequestInput[] | undefined> {
  if (args.pullRequests !== undefined) {
    return args.pullRequests as AssociatedPullRequestInput[];
  }

  if (args.pullRequest === undefined) {
    return undefined;
  }

  const incoming = args.pullRequest as AssociatedPullRequestInput;
  const existing = await loadExistingPullRequests(api, scope);
  return mergePullRequest(existing, incoming);
}

async function loadExistingPullRequests(
  api: TodoApiClient,
  scope: { todoId: string } | { todoId: string; subtaskId: string },
): Promise<AssociatedPullRequestInput[]> {
  const todo = await api.getTodo(scope.todoId);

  if ('subtaskId' in scope) {
    const subtask = findSubtask(todo, scope.subtaskId);
    return (subtask.pullRequests ?? []).map(toPullRequestInput);
  }

  return (todo.pullRequests ?? []).map(toPullRequestInput);
}

function findSubtask(todo: TodoDto, subtaskId: string): SubtaskDto {
  const subtask = todo.subtasks?.find((item: SubtaskDto) => item.id === subtaskId);
  if (!subtask) {
    throw new Error(`Subtask not found: ${subtaskId}`);
  }
  return subtask;
}

export async function addAssociatedPullRequest(
  api: TodoApiClient,
  args: Record<string, unknown>,
): Promise<TodoDto | SubtaskDto> {
  const todoId = args.todoId as string;
  const subtaskId = args.subtaskId as string | undefined;
  const incoming: AssociatedPullRequestInput = {
    number: args.number as number,
    title: args.title as string,
    status: args.status as string,
    url: args.url as string,
  };

  if (subtaskId) {
    const existing = await loadExistingPullRequests(api, { todoId, subtaskId });
    return api.updateSubtask(todoId, subtaskId, {
      pullRequests: mergePullRequest(existing, incoming),
    });
  }

  const existing = await loadExistingPullRequests(api, { todoId });
  return api.updateTodo(todoId, {
    pullRequests: mergePullRequest(existing, incoming),
  });
}
