import { TodoStatus, SubtaskStatus, type TodoDto } from '@todo-platform/shared-types';

export const TODO_STATUS_ORDER: TodoStatus[] = [
  TodoStatus.TODO,
  TodoStatus.IN_PROGRESS,
  TodoStatus.TESTING,
  TodoStatus.BLOCKED,
  TodoStatus.COMPLETED,
];

export const SUBTASK_STATUS_ORDER: SubtaskStatus[] = [
  SubtaskStatus.NOT_STARTED,
  SubtaskStatus.IN_PROGRESS,
  SubtaskStatus.TESTING,
  SubtaskStatus.COMPLETED,
  SubtaskStatus.FAILED,
];

export function todoStatusLabel(status: TodoStatus): string {
  switch (status) {
    case TodoStatus.TODO:
      return 'To Do';
    case TodoStatus.IN_PROGRESS:
      return 'In Progress';
    case TodoStatus.TESTING:
      return 'Testing';
    case TodoStatus.BLOCKED:
      return 'Blocked';
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
