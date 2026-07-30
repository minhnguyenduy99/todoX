import { TodoStatus } from '@todo-platform/shared-types';

export function todoStatusUpdateData(
  status: TodoStatus,
  at: Date = new Date(),
): { status: TodoStatus; statusUpdateDate: Date } {
  return { status, statusUpdateDate: at };
}
