import type { TodoApiClient } from '@todo-platform/shared-api';
import type {
  AssociatedTicketDto,
  AssociatedTicketInput,
  TodoDto,
} from '@todo-platform/shared-types';

const jiraTitleGuidance =
  "When linking a Jira issue, set title to the Jira ticket's title exactly as shown in Jira (do not use the todo title or a summary).";

export const associatedTicketSchema = {
  type: 'object' as const,
  description: `Associated external feature or bug ticket. ${jiraTitleGuidance}`,
  properties: {
    title: {
      type: 'string',
      description: `Ticket title. ${jiraTitleGuidance}`,
    },
    type: {
      type: 'string',
      enum: ['feature', 'bug'],
      description: 'Whether the external ticket is a feature or a bug',
    },
    link: {
      type: 'string',
      description: 'URL to the external ticket (e.g. Jira issue URL)',
    },
  },
  required: ['title', 'type', 'link'],
};

export function toAssociatedTicketInput(
  ticket: AssociatedTicketDto,
): AssociatedTicketInput {
  return {
    title: ticket.title,
    type: ticket.type,
    link: ticket.link,
  };
}

export function mergeAssociatedTicket(
  existing: AssociatedTicketInput[],
  incoming: AssociatedTicketInput,
): AssociatedTicketInput[] {
  if (existing.some((ticket) => ticket.link === incoming.link)) {
    return existing.map((ticket) =>
      ticket.link === incoming.link ? incoming : ticket,
    );
  }
  return [...existing, incoming];
}

export function resolveCreateAssociatedTickets(
  args: Record<string, unknown>,
): AssociatedTicketInput[] | undefined {
  if (args.associatedTickets !== undefined) {
    return args.associatedTickets as AssociatedTicketInput[];
  }

  if (args.associatedTicket !== undefined) {
    return [args.associatedTicket as AssociatedTicketInput];
  }

  return undefined;
}

export async function resolveUpdateAssociatedTickets(
  api: TodoApiClient,
  todoId: string,
  args: Record<string, unknown>,
): Promise<AssociatedTicketInput[] | undefined> {
  if (args.associatedTickets !== undefined) {
    return args.associatedTickets as AssociatedTicketInput[];
  }

  if (args.associatedTicket === undefined) {
    return undefined;
  }

  const incoming = args.associatedTicket as AssociatedTicketInput;
  const existing = await loadExistingAssociatedTickets(api, todoId);
  return mergeAssociatedTicket(existing, incoming);
}

async function loadExistingAssociatedTickets(
  api: TodoApiClient,
  todoId: string,
): Promise<AssociatedTicketInput[]> {
  const todo = await api.getTodo(todoId);
  return (todo.associatedTickets ?? []).map(toAssociatedTicketInput);
}

export async function addAssociatedTicket(
  api: TodoApiClient,
  args: Record<string, unknown>,
): Promise<TodoDto> {
  const todoId = args.todoId as string;
  const incoming: AssociatedTicketInput = {
    title: args.title as string,
    type: args.type as AssociatedTicketInput['type'],
    link: args.link as string,
  };

  const existing = await loadExistingAssociatedTickets(api, todoId);
  return api.updateTodo(todoId, {
    associatedTickets: mergeAssociatedTicket(existing, incoming),
  });
}

export const addAssociatedTicketDescription =
  `Associate an external feature/bug ticket with a todo. Appends to existing tickets without replacing them (same link updates in place). ${jiraTitleGuidance}`;
