import type { AssociatedTicketDto } from '@todo-platform/shared-types';

const JIRA_TICKET_ID_PATTERN = /([A-Z][A-Z0-9]+-\d+)/i;

export function extractJiraTicketId(link: string): string | null {
  try {
    const url = new URL(link);
    const browseMatch = url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
    if (browseMatch) {
      return browseMatch[1].toUpperCase();
    }

    const pathMatch = url.pathname.match(JIRA_TICKET_ID_PATTERN);
    if (pathMatch) {
      return pathMatch[1].toUpperCase();
    }
  } catch {
    return null;
  }

  return null;
}

export function formatAssociatedTicketLabel(ticket: AssociatedTicketDto): string {
  const ticketId = extractJiraTicketId(ticket.link);
  if (!ticketId) {
    return ticket.title;
  }

  const normalizedTitle = ticket.title.trim();
  const idPrefix = `${ticketId}:`;
  const idPrefixWithSpace = `${ticketId} `;

  if (
    normalizedTitle.toUpperCase().startsWith(idPrefix.toUpperCase()) ||
    normalizedTitle.toUpperCase().startsWith(idPrefixWithSpace.toUpperCase()) ||
    normalizedTitle.toUpperCase() === ticketId
  ) {
    return normalizedTitle;
  }

  return `${ticketId}: ${normalizedTitle}`;
}
