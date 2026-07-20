import type { MouseEvent } from 'react';
import {
  AssociatedTicketType,
  type AssociatedTicketDto,
} from '@todo-platform/shared-types';
import { formatAssociatedTicketLabel } from '../utils/ticketUtils';

interface AssociatedTicketListProps {
  associatedTickets: AssociatedTicketDto[];
  compact?: boolean;
}

function ticketTypeClassName(type: AssociatedTicketType): string {
  return type === AssociatedTicketType.FEATURE ? 'ticket-type-feature' : 'ticket-type-bug';
}

function handleTicketClick(e: MouseEvent) {
  e.stopPropagation();
}

export function AssociatedTicketList({
  associatedTickets,
  compact = false,
}: AssociatedTicketListProps) {
  if (associatedTickets.length === 0) return null;

  const typeLabel = (type: AssociatedTicketType) =>
    type === AssociatedTicketType.FEATURE ? 'feature' : 'bug';

  return (
    <div className={`ticket-list${compact ? ' ticket-list-compact' : ''}`}>
      {associatedTickets.map((ticket) => (
        <a
          key={ticket.id}
          className={`ticket-item ${ticketTypeClassName(ticket.type)}${compact ? ' ticket-item-compact' : ''}`}
          href={ticket.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleTicketClick}
          title={ticket.link}
        >
          <span className={`ticket-type ${ticketTypeClassName(ticket.type)}`}>
            {typeLabel(ticket.type)}
          </span>
          <span className="ticket-title">{formatAssociatedTicketLabel(ticket)}</span>
        </a>
      ))}
    </div>
  );
}
