import type { TodoDto } from '@todo-platform/shared-types';
import { todoStatusColor, subtaskStatusColor } from '../api';
import { PullRequestList } from './PullRequestList';
import { AssociatedTicketList } from './AssociatedTicketList';
import { DeployedEnvironmentList } from './DeployedEnvironmentList';
import { TestcaseScanList } from './TestcaseScanList';
import { CopyableUuid } from './CopyableUuid';
import { getActiveTestcaseScans } from '../utils/testcaseScanDisplay';
import { ServiceBadge } from './ServiceBadge';

interface TodoCardProps {
  todo: TodoDto;
  compact?: boolean;
  compactUuid?: boolean;
  showSubtasks?: boolean;
  showSubtaskCount?: boolean;
  showStatus?: boolean;
  showDescription?: boolean;
  showAssociatedTickets?: boolean;
  showPullRequests?: boolean;
  onClick?: () => void;
}

export function TodoCard({
  todo,
  compact = false,
  compactUuid = false,
  showSubtasks = true,
  showSubtaskCount = false,
  showStatus = true,
  showDescription = true,
  showAssociatedTickets = true,
  showPullRequests = true,
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
          <div className="todo-id-row">
            <CopyableUuid uuid={todo.id} compact={compactUuid} />
            {todo.service && <ServiceBadge service={todo.service} compact={compactUuid} />}
          </div>
          <div className="todo-title">{todo.title}</div>
          {showPullRequests && (
            <PullRequestList
              pullRequests={todo.pullRequests ?? []}
              compact={compact}
            />
          )}
          {showAssociatedTickets && (
            <AssociatedTicketList associatedTickets={todo.associatedTickets ?? []} compact={compact} />
          )}
          <DeployedEnvironmentList
            deployedEnvironments={todo.deployedEnvironments ?? []}
            compact={compact}
          />
          <TestcaseScanList
            scans={getActiveTestcaseScans(todo.testcaseScanHistory)}
            compact
          />
          {showDescription && todo.description && (
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
                  {showPullRequests && (
                    <PullRequestList
                      pullRequests={subtask.pullRequests ?? []}
                      compact={compact}
                    />
                  )}
                  <DeployedEnvironmentList
                    deployedEnvironments={subtask.deployedEnvironments ?? []}
                    compact={compact}
                  />
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
