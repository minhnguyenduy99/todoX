import { useEffect } from 'react';
import type { TodoDto } from '@todo-platform/shared-types';
import { subtaskStatusColor } from '../api';
import { PullRequestList } from './PullRequestList';
import { AssociatedTicketList } from './AssociatedTicketList';
import { DeployedEnvironmentList } from './DeployedEnvironmentList';
import { TestcaseScanList } from './TestcaseScanList';
import { CopyableUuid } from './CopyableUuid';
import { ServiceBadge } from './ServiceBadge';
import { MarkdownContent } from './MarkdownContent';

interface SubtaskPanelProps {
  todo: TodoDto;
  onClose: () => void;
}

export function SubtaskPanel({ todo, onClose }: SubtaskPanelProps) {
  const subtasks = todo.subtasks ?? [];
  const pullRequests = todo.pullRequests ?? [];
  const associatedTickets = todo.associatedTickets ?? [];
  const deployedEnvironments = todo.deployedEnvironments ?? [];
  const testcaseScanHistory = todo.testcaseScanHistory ?? [];

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
          <div className="subtask-panel-header-content">
            <CopyableUuid uuid={todo.id} />
            <h2 id="subtask-panel-title" className="subtask-panel-title">
              {todo.title}
            </h2>
          </div>
          <button type="button" className="subtask-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="subtask-panel-body">
          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Service</h3>
            {todo.service ? (
              <ServiceBadge service={todo.service} />
            ) : (
              <p className="subtask-panel-empty-field">No service assigned</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Tickets</h3>
            {associatedTickets.length > 0 ? (
              <AssociatedTicketList associatedTickets={associatedTickets} />
            ) : (
              <p className="subtask-panel-empty-field">No associated tickets</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">PR</h3>
            {pullRequests.length > 0 ? (
              <PullRequestList pullRequests={pullRequests} />
            ) : (
              <p className="subtask-panel-empty-field">No pull requests</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Deployments</h3>
            {deployedEnvironments.length > 0 ? (
              <DeployedEnvironmentList
                deployedEnvironments={deployedEnvironments}
                layout="lines"
              />
            ) : (
              <p className="subtask-panel-empty-field">Not deployed yet</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Testcase scans</h3>
            {testcaseScanHistory.length > 0 ? (
              <TestcaseScanList scans={testcaseScanHistory} layout="lines" />
            ) : (
              <p className="subtask-panel-empty-field">No testcase scans yet</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Description</h3>
            {todo.description ? (
              <div className="subtask-panel-description-content">
                <MarkdownContent className="subtask-panel-description">
                  {todo.description}
                </MarkdownContent>
              </div>
            ) : (
              <p className="subtask-panel-empty-field">No description</p>
            )}
          </section>

          <section className="subtask-panel-field">
            <h3 className="subtask-panel-label">Changelog</h3>
            {todo.changelog ? (
              <div className="subtask-panel-description-content">
                <MarkdownContent className="subtask-panel-description">
                  {todo.changelog}
                </MarkdownContent>
              </div>
            ) : (
              <p className="subtask-panel-empty-field">No changelog</p>
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
