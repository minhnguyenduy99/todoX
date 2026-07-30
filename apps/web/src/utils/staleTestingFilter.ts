import { TodoStatus, type TodoDto } from '@todo-platform/shared-types';

export const STALE_TESTING_THRESHOLD_MS = 72 * 60 * 60 * 1000;

export function isTodoStaleInTesting(todo: TodoDto, nowMs: number): boolean {
  if (todo.status !== TodoStatus.TESTING) return false;
  if (!todo.statusUpdateDate) return false;

  const statusUpdateMs = new Date(todo.statusUpdateDate).getTime();
  if (Number.isNaN(statusUpdateMs)) return false;

  return nowMs - statusUpdateMs >= STALE_TESTING_THRESHOLD_MS;
}

export function filterTodosStaleInTesting(
  todos: TodoDto[],
  enabled: boolean,
  nowMs: number = Date.now(),
): TodoDto[] {
  if (!enabled) return todos;
  return todos.filter((todo) => isTodoStaleInTesting(todo, nowMs));
}
