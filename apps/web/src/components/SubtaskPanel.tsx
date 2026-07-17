import { useEffect } from 'react';
import type { TodoDto } from '@todo-platform/shared-types';
import { subtaskStatusColor } from '../api';
import { PullRequestList } from './PullRequestList';

interface SubtaskPanelProps {
  todo: TodoDto;
  onClose: () => void;
}

export function SubtaskPanel({ todo, onClose }: SubtaskPanelProps) {
  const subtasks = todo.subtasks ?? [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="subtask-panel-overlay" onClick={onClose}>
      <div
        className="subtask-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="subtask-panel-title"
      >
        <div className="subtask-panel-header">
          <div>
            <h2 id="subtask-panel-title" className="subtask-panel-title">
              {todo.title}
            </h2>
            <PullRequestList pullRequests={todo.pullRequests ?? []} />
            {todo.description && (
              <p className="subtask-panel-description">{todo.description}</p>
            )}
          </div>
          <button type="button" className="subtask-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {subtasks.length === 0 ? (
          <p className="subtask-panel-empty">No subtasks for this todo.</p>
        ) : (
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
        )}
      </div>
    </div>
  );
}
