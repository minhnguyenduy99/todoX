import type { AssociatedTicketInput } from '@todo-platform/shared-types';
import type { PrismaService } from '../prisma/prisma.service';

export async function syncAssociatedTickets(
  prisma: PrismaService,
  todoId: string,
  associatedTickets: AssociatedTicketInput[] | undefined,
): Promise<void> {
  if (associatedTickets === undefined) return;

  await prisma.$transaction([
    prisma.associatedTicket.deleteMany({ where: { todoId } }),
    ...associatedTickets.map((ticket) =>
      prisma.associatedTicket.create({
        data: {
          todoId,
          title: ticket.title,
          type: ticket.type,
          link: ticket.link,
        },
      }),
    ),
  ]);
}
