import { TodoStatus, SubtaskStatus, type TodoDto } from '@todo-platform/shared-types';

export const TODO_STATUS_ORDER: TodoStatus[] = [
  TodoStatus.NOT_STARTED,
  TodoStatus.IN_PROGRESS,
  TodoStatus.TESTING,
  TodoStatus.WAIT_FOR_STAGING,
  TodoStatus.COMPLETED,
];

export const SUBTASK_STATUS_ORDER: SubtaskStatus[] = [
  SubtaskStatus.NOT_STARTED,
  SubtaskStatus.IN_PROGRESS,
  SubtaskStatus.TESTING,
  SubtaskStatus.COMPLETED,
  SubtaskStatus.FAILED,
];

export function todoStatusClassName(status: TodoStatus): string {
  return `status-${status.toLowerCase().replace(/_/g, '-')}`;
}

export function todoStatusLabel(status: TodoStatus): string {
  switch (status) {
    case TodoStatus.NOT_STARTED:
      return 'Not Started';
    case TodoStatus.IN_PROGRESS:
      return 'In Progress';
    case TodoStatus.TESTING:
      return 'Testing';
    case TodoStatus.WAIT_FOR_STAGING:
      return 'Wait for Staging';
    case TodoStatus.COMPLETED:
      return 'Completed';
    default:
      return status;
  }
}

export function groupTodosByStatus(todos: TodoDto[]): Map<TodoStatus, TodoDto[]> {
  const groups = new Map<TodoStatus, TodoDto[]>(
    TODO_STATUS_ORDER.map((status) => [status, []]),
  );

  for (const todo of todos) {
    const list = groups.get(todo.status);
    if (list) {
      list.push(todo);
    } else {
      groups.set(todo.status, [todo]);
    }
  }

  return groups;
}
