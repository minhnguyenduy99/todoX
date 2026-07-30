import type { AssociatedPullRequestDto, TodoDto } from '@todo-platform/shared-types';
import { extractJiraTicketId } from '../../utils/ticketUtils';

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function pullRequestMatchesQuery(
  pullRequest: AssociatedPullRequestDto,
  normalizedQuery: string,
): boolean {
  if (pullRequest.title.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  const numberQuery = normalizedQuery.startsWith('#')
    ? normalizedQuery.slice(1)
    : normalizedQuery;
  if (numberQuery && String(pullRequest.number).includes(numberQuery)) {
    return true;
  }

  return false;
}

export function todoMatchesSearchQuery(todo: TodoDto, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  if (todo.title.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  const tickets = todo.associatedTickets ?? [];
  for (const ticket of tickets) {
    if (ticket.title.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    const ticketId = extractJiraTicketId(ticket.link);
    if (ticketId && ticketId.toLowerCase().includes(normalizedQuery)) {
      return true;
    }
  }

  const pullRequests = [
    ...(todo.pullRequests ?? []),
    ...(todo.subtasks ?? []).flatMap((subtask) => subtask.pullRequests ?? []),
  ];
  for (const pullRequest of pullRequests) {
    if (pullRequestMatchesQuery(pullRequest, normalizedQuery)) {
      return true;
    }
  }

  return false;
}
