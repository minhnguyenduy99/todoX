import { MonitorType, TodoStatus, type MonitorResult } from '@todo-platform/shared-types';
import type { PrismaService } from '../prisma/prisma.service';
import { toMonitorResult } from './mappers';
import { NON_TERMINAL_RELEASE_STATUSES } from './release-constants';
import {
  isTodoStatusSyncSuppressedForDeploymentMonitor,
  reconcileTodoStatusFromDeploymentMonitors,
  shouldApplyTodoStatusTransition,
  shouldKeepDeploymentMonitorActiveAfterPoll,
} from './todo-deployment-status-sync';
import { todoStatusUpdateData } from './todo-status-update';

/** Apply level-triggered deploy status sync after PR updates or monitor changes. */
export async function applyTodoDeployStatusReconcile(
  prisma: PrismaService,
  todoId: string,
  options?: {
    disableMonitors?: (monitorId: string) => Promise<void>;
  },
): Promise<TodoStatus | null> {
  const onRelease = await prisma.releaseMember.findFirst({
    where: {
      todoId,
      release: { status: { in: NON_TERMINAL_RELEASE_STATUSES } },
    },
    select: { id: true },
  });
  if (onRelease) return null;

  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    include: {
      pullRequests: { select: { status: true } },
      monitors: true,
    },
  });
  if (!todo) return null;

  const originalStatus = todo.status as TodoStatus;
  const monitors = todo.monitors
    .filter((m) => !isTodoStatusSyncSuppressedForDeploymentMonitor(m.config))
    .map((m) => ({
      id: m.id,
      type: m.type,
      config: m.config,
      lastResult: toMonitorResult(m.lastResult) as MonitorResult | null,
      lastRunAt: m.lastRunAt,
      enabled: m.enabled,
    }));

  const nextStatus = reconcileTodoStatusFromDeploymentMonitors(
    originalStatus,
    todo.pullRequests,
    monitors,
  );

  let statusAfter = originalStatus;
  if (nextStatus && shouldApplyTodoStatusTransition(statusAfter, nextStatus)) {
    await prisma.todo.update({
      where: { id: todoId },
      data: todoStatusUpdateData(nextStatus),
    });
    statusAfter = nextStatus;
  }

  if (options?.disableMonitors) {
    for (const monitor of monitors) {
      if (!monitor.enabled || monitor.type !== MonitorType.DEPLOYMENT) continue;
      if (!monitor.lastResult) continue;
      if (
        !shouldKeepDeploymentMonitorActiveAfterPoll(
          monitor.lastResult,
          monitor.type,
          monitor.config,
          statusAfter,
          todo.pullRequests,
        )
      ) {
        await options.disableMonitors(monitor.id);
      }
    }
  }

  return statusAfter !== originalStatus ? statusAfter : null;
}
