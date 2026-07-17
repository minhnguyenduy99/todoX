import type { AssociatedPullRequestInput } from '@todo-platform/shared-types';
import type { PrismaService } from '../prisma/prisma.service';

export async function syncPullRequests(
  prisma: PrismaService,
  scope: { todoId: string } | { subtaskId: string },
  pullRequests: AssociatedPullRequestInput[] | undefined,
): Promise<void> {
  if (pullRequests === undefined) return;

  const where = 'todoId' in scope ? { todoId: scope.todoId } : { subtaskId: scope.subtaskId };

  await prisma.$transaction([
    prisma.associatedPullRequest.deleteMany({ where }),
    ...pullRequests.map((pr) =>
      prisma.associatedPullRequest.create({
        data: {
          ...where,
          number: pr.number,
          title: pr.title,
          status: pr.status,
          url: pr.url,
        },
      }),
    ),
  ]);
}
