import { useEffect } from 'react';
import type { TodoDto } from '@todo-platform/shared-types';
import { subtaskStatusColor } from '../api';
import { PullRequestList } from './PullRequestList';
import { DeployedEnvironmentList } from './DeployedEnvironmentList';

interface SubtaskPanelProps {
  todo: TodoDto;
  onClose: () => void;
}

export function SubtaskPanel({ todo, onClose }: SubtaskPanelProps) {
  const subtasks = todo.subtasks ?? [];
  const pullRequests = todo.pullRequests ?? [];
  const deployedEnvironments = todo.deployedEnvironments ?? [];

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
          <h2 id="subtask-panel-title" className="subtask-panel-title">
            {todo.title}
          </h2>
          <button type="button" className="subtask-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="subtask-panel-body">
          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">PR</h3>
            {pullRequests.length > 0 ? (
              <PullRequestList pullRequests={pullRequests} />
            ) : (
              <p className="subtask-panel-empty-field">No pull requests</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Environments</h3>
            {deployedEnvironments.length > 0 ? (
              <DeployedEnvironmentList deployedEnvironments={deployedEnvironments} />
            ) : (
              <p className="subtask-panel-empty-field">Not deployed yet</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Description</h3>
            {todo.description ? (
              <div className="subtask-panel-description-content">
                <p className="subtask-panel-description">{todo.description}</p>
              </div>
            ) : (
              <p className="subtask-panel-empty-field">No description</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Subtasks</h3>
            {subtasks.length === 0 ? (
              <p className="subtask-panel-empty-field">No subtasks for this todo.</p>
            ) : (
              <ul className="subtask-list subtask-panel-list">
                {subtasks.map((subtask) => (
                  <li key={subtask.id} className="subtask-item">
                    <div className="subtask-item-content">
                      <span className="subtask-name">{subtask.name}</span>
                      <PullRequestList pullRequests={subtask.pullRequests ?? []} />
                      <DeployedEnvironmentList
                        deployedEnvironments={subtask.deployedEnvironments ?? []}
                      />
                    </div>
                    <span className={`badge ${subtaskStatusColor(subtask.status)}`}>
                      {subtask.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
