import type { TodoDto } from '@todo-platform/shared-types';
import { normalizeSearchQuery, todoMatchesSearchQuery } from './matchTodo';
import type { TodoSearchService } from './todoSearchService';

export const localTodoSearchService: TodoSearchService = {
  filterTodos(todos: TodoDto[], query: string): TodoDto[] {
    const normalizedQuery = normalizeSearchQuery(query);
    if (!normalizedQuery) {
      return todos;
    }
    return todos.filter((todo) => todoMatchesSearchQuery(todo, normalizedQuery));
  },
};
