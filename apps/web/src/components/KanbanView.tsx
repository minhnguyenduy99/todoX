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

interface KanbanViewProps {
  todos: TodoDto[];
  /** Full cache list for panel lookup so live updates work when filters exclude the todo. */
  allTodos: TodoDto[];
}

export function KanbanView({ todos, allTodos }: KanbanViewProps) {
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const selectedTodo =
    selectedTodoId != null
      ? allTodos.find((todo) => todo.id === selectedTodoId) ?? null
      : null;
  const groups = groupTodosByStatus(todos);

  return (
    <>
      <div className="kanban-board">
        {TODO_STATUS_ORDER.map((status) => {
          const items = groups.get(status) ?? [];

          return (
            <div key={status} className="kanban-column">
              <div className={`kanban-column-header ${todoStatusClassName(status)}`}>
                <h2 className="kanban-column-title">{todoStatusLabel(status)}</h2>
                <span className="kanban-column-count">{items.length}</span>
              </div>
              <div className="kanban-column-items">
                {items.map((todo) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    {...COMPACT_TODO_CARD_PROPS}
                    cardLayout="kanban"
                    onClick={() => setSelectedTodoId(todo.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTodo && (
        <SubtaskPanel todo={selectedTodo} onClose={() => setSelectedTodoId(null)} />
      )}
    </>
  );
}
