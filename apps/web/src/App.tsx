import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTodos } from './api';
import { useWebSocket } from './hooks/useWebSocket';
import { TodoListView } from './components/TodoListView';
import { KanbanView } from './components/KanbanView';

type ViewMode = 'list' | 'kanban';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const connected = useWebSocket();
  const { data: todos, isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });

  return (
    <div className="app">
      <header className="header">
        <h1>Todo Platform</h1>
        <div className="header-actions">
          {todos && todos.length > 0 && (
            <div className="view-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
              <button
                type="button"
                className={`view-toggle-btn${viewMode === 'kanban' ? ' active' : ''}`}
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </button>
            </div>
          )}
          <div className="connection-status">
            <span className={`connection-dot ${connected ? 'connected' : ''}`} />
            {connected ? 'Live updates active' : 'Connecting...'}
          </div>
        </div>
      </header>

      {error && (
        <div className="error">
          Failed to load todos: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {isLoading && <div className="loading">Loading todos...</div>}

      {!isLoading && todos && todos.length === 0 && (
        <div className="empty-state">
          <h2>No todos yet</h2>
          <p>Create todos via the MCP server or REST API to see them here.</p>
        </div>
      )}

      {todos && todos.length > 0 && (
        viewMode === 'list' ? <TodoListView todos={todos} /> : <KanbanView todos={todos} />
      )}
    </div>
  );
}
