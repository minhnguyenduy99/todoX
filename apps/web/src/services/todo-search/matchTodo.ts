import type { TodoDto } from '@todo-platform/shared-types';
import { extractJiraTicketId } from '../../utils/ticketUtils';

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
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

  return false;
}
