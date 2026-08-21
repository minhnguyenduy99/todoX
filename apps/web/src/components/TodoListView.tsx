import { useState } from 'react';
import type { TodoDto } from '@todo-platform/shared-types';
import { TodoCard } from './TodoCard';
import { SubtaskPanel } from './SubtaskPanel';
import { COMPACT_TODO_CARD_PROPS } from './compactTodoCardProps';
import {
  groupTodosByStatus,
  todoStatusClassName,
  todoStatusLabel,
  TODO_STATUS_ORDER,
} from '../utils/statusUtils';

interface TodoListViewProps {
  todos: TodoDto[];
  /** Full cache list for panel lookup so live updates work when filters exclude the todo. */
  allTodos: TodoDto[];
}

export function TodoListView({ todos, allTodos }: TodoListViewProps) {
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const selectedTodo =
    selectedTodoId != null
      ? allTodos.find((todo) => todo.id === selectedTodoId) ?? null
      : null;
  const groups = groupTodosByStatus(todos);

  return (
    <>
      <div className="todo-list-view">
        {TODO_STATUS_ORDER.map((status) => {
          const items = groups.get(status) ?? [];
          if (items.length === 0) return null;

          return (
            <section key={status} className="status-group">
              <div className={`status-group-header ${todoStatusClassName(status)}`}>
                <h2 className="status-group-title">{todoStatusLabel(status)}</h2>
                <span className="status-group-count">{items.length}</span>
              </div>
              <div className="status-group-items">
                {items.map((todo) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    {...COMPACT_TODO_CARD_PROPS}
                    cardLayout="list"
                    onClick={() => setSelectedTodoId(todo.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {selectedTodo && (
        <SubtaskPanel todo={selectedTodo} onClose={() => setSelectedTodoId(null)} />
      )}
    </>
  );
}
