import { useState } from 'react';
import type { TodoDto } from '@todo-platform/shared-types';
import { TodoCard } from './TodoCard';
import { SubtaskPanel } from './SubtaskPanel';
import {
  groupTodosByStatus,
  todoStatusClassName,
  todoStatusLabel,
  TODO_STATUS_ORDER,
} from '../utils/statusUtils';

interface KanbanViewProps {
  todos: TodoDto[];
}

export function KanbanView({ todos }: KanbanViewProps) {
  const [selectedTodo, setSelectedTodo] = useState<TodoDto | null>(null);
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
                    compact
                    compactUuid
                    showSubtasks={false}
                    showSubtaskCount
                    showStatus={false}
                    showDescription={false}
                    showAssociatedTickets={false}
                    onClick={() => setSelectedTodo(todo)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTodo && (
        <SubtaskPanel todo={selectedTodo} onClose={() => setSelectedTodo(null)} />
      )}
    </>
  );
}
