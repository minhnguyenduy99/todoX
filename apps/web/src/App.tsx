import { useQuery } from '@tanstack/react-query';
import { fetchTodos } from './api';
import { useWebSocket } from './hooks/useWebSocket';
import { TodoCard } from './components/TodoCard';

export function App() {
  const connected = useWebSocket();
  const { data: todos, isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });

  return (
    <div className="app">
      <header className="header">
        <h1>Todo Platform</h1>
        <div className="connection-status">
          <span className={`connection-dot ${connected ? 'connected' : ''}`} />
          {connected ? 'Live updates active' : 'Connecting...'}
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
        <div className="todo-grid">
          {todos.map((todo) => (
            <TodoCard key={todo.id} todo={todo} />
          ))}
        </div>
      )}
    </div>
  );
}
