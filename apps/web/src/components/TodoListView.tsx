import type { TodoDto } from '@todo-platform/shared-types';
import { TodoCard } from './TodoCard';
import { groupTodosByStatus, todoStatusLabel, TODO_STATUS_ORDER } from '../utils/statusUtils';

interface TodoListViewProps {
  todos: TodoDto[];
}

export function TodoListView({ todos }: TodoListViewProps) {
  const groups = groupTodosByStatus(todos);

  return (
    <div className="todo-list-view">
      {TODO_STATUS_ORDER.map((status) => {
        const items = groups.get(status) ?? [];
        if (items.length === 0) return null;

        return (
          <section key={status} className="status-group">
            <div className="status-group-header">
              <h2 className="status-group-title">{todoStatusLabel(status)}</h2>
              <span className="status-group-count">{items.length}</span>
            </div>
            <div className="status-group-items">
              {items.map((todo) => (
                <TodoCard key={todo.id} todo={todo} compact showSubtasks />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
