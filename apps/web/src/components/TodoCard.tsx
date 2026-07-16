import type { TodoDto } from '@todo-platform/shared-types';
import {
  todoStatusColor,
  subtaskStatusColor,
  monitorResultColor,
  formatDate,
} from '../api';

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
          <div className="subtask-header">
            <span>Name</span>
            <span>Status</span>
            <span>Monitor</span>
            <span>Last Checked</span>
            <span>Result</span>
          </div>
          {subtasks.map((subtask) => (
            <div key={subtask.id} className="subtask-row">
              <span>{subtask.name}</span>
              <span>
                <span className={`badge ${subtaskStatusColor(subtask.status)}`}>
                  {subtask.status}
                </span>
              </span>
              <span className="monitor-info">
                {subtask.monitor ? (
                  <span className="badge badge-blue">{subtask.monitor.type}</span>
                ) : (
                  <span className="badge badge-gray">None</span>
                )}
              </span>
              <span>{formatDate(subtask.monitor?.lastRunAt)}</span>
              <span>
                {subtask.monitor?.lastResult ? (
                  <div>
                    <span
                      className={`badge ${monitorResultColor(subtask.monitor.lastResult.status)}`}
                    >
                      {subtask.monitor.lastResult.status}
                    </span>
                    <div className="monitor-result">
                      {subtask.monitor.lastResult.message}
                    </div>
                  </div>
                ) : (
                  <span className="badge badge-gray">—</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
