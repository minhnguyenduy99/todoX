import type { TodoDto } from '@todo-platform/shared-types';
import { todoStatusColor, subtaskStatusColor } from '../api';
import { PullRequestList } from './PullRequestList';

interface TodoCardProps {
  todo: TodoDto;
  compact?: boolean;
  showSubtasks?: boolean;
  showSubtaskCount?: boolean;
  showStatus?: boolean;
  onClick?: () => void;
}

export function TodoCard({
  todo,
  compact = false,
  showSubtasks = true,
  showSubtaskCount = false,
  showStatus = true,
  onClick,
}: TodoCardProps) {
  const subtasks = todo.subtasks ?? [];
  const isInteractive = Boolean(onClick);

  return (
    <div
      className={`todo-card${compact ? ' todo-card-compact' : ''}${isInteractive ? ' todo-card-interactive' : ''}`}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <div className="todo-header">
        <div className="todo-header-content">
          <div className="todo-title">{todo.title}</div>
          <PullRequestList
            pullRequests={todo.pullRequests ?? []}
            compact={compact}
          />
          {todo.description && (
            <div className="todo-description">{todo.description}</div>
          )}
          {showSubtaskCount && subtasks.length > 0 && (
            <div className="subtask-count">
              {subtasks.length} subtask{subtasks.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
        {showStatus && (
          <span className={`badge ${todoStatusColor(todo.status)}`}>{todo.status}</span>
        )}
      </div>

      {showSubtasks && subtasks.length > 0 && (
        <div className="subtasks">
          <h3>Subtasks</h3>
          <ul className="subtask-list">
            {subtasks.map((subtask) => (
              <li key={subtask.id} className="subtask-item">
                <div className="subtask-item-content">
                  <span className="subtask-name">{subtask.name}</span>
                  <PullRequestList pullRequests={subtask.pullRequests ?? []} />
                </div>
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
