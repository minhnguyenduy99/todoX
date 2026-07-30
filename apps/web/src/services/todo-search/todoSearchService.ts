import type { TodoDto } from '@todo-platform/shared-types';

export interface TodoSearchService {
  filterTodos(todos: TodoDto[], query: string): TodoDto[];
}
