import type { TodoDto } from '@todo-platform/shared-types';
import { todoStatusColor, subtaskStatusColor } from '../api';

interface TodoCardProps {
  todo: TodoDto;
}

export function TodoCard({ todo }: TodoCardProps) {
  const subtasks = todo.subtasks ?? [];

  return (
    <div className="todo-card">
      <div className="todo-header">
        <div>
          <div className="todo-title">{todo.title}</div>
          {todo.description && (
            <div className="todo-description">{todo.description}</div>
          )}
        </div>
        <span className={`badge ${todoStatusColor(todo.status)}`}>{todo.status}</span>
      </div>

      {subtasks.length > 0 && (
        <div className="subtasks">
          <h3>Subtasks</h3>
          <ul className="subtask-list">
            {subtasks.map((subtask) => (
              <li key={subtask.id} className="subtask-item">
                <span className="subtask-name">{subtask.name}</span>
                <span className={`badge ${subtaskStatusColor(subtask.status)}`}>
                  {subtask.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
