import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { WebSocketEvent, TodoDto, SubtaskDto } from '@todo-platform/shared-types';
import { getWsUrl } from '../api';

export function useWebSocket(): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as WebSocketEvent;
          handleEvent(data, queryClient);
        } catch {
          // ignore malformed messages
        }
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [queryClient]);

  return connected;
}

function handleEvent(
  event: WebSocketEvent,
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  const todos = queryClient.getQueryData<TodoDto[]>(['todos']) ?? [];

  switch (event.type) {
    case 'todo.created': {
      const todo = event.payload as TodoDto;
      queryClient.setQueryData<TodoDto[]>(['todos'], [todo, ...todos]);
      break;
    }
    case 'todo.updated': {
      const todo = event.payload as TodoDto;
      queryClient.setQueryData<TodoDto[]>(['todos'], (old = []) =>
        old.map((t) => (t.id === todo.id ? todo : t)),
      );
      break;
    }
    case 'todo.deleted': {
      const { id } = event.payload as { id: string };
      queryClient.setQueryData<TodoDto[]>(['todos'], (old = []) =>
        old.filter((t) => t.id !== id),
      );
      break;
    }
    case 'subtask.created':
    case 'subtask.updated': {
      const subtask = event.payload as SubtaskDto;
      queryClient.setQueryData<TodoDto[]>(['todos'], (old = []) =>
        old.map((todo) => {
          if (todo.id !== subtask.todoId) return todo;
          const subtasks = todo.subtasks ?? [];
          const exists = subtasks.some((s) => s.id === subtask.id);
          return {
            ...todo,
            subtasks: exists
              ? subtasks.map((s) => (s.id === subtask.id ? subtask : s))
              : [...subtasks, subtask],
          };
        }),
      );
      break;
    }
    case 'subtask.deleted': {
      const { id, todoId } = event.payload as { id: string; todoId: string };
      queryClient.setQueryData<TodoDto[]>(['todos'], (old = []) =>
        old.map((todo) =>
          todo.id === todoId
            ? { ...todo, subtasks: (todo.subtasks ?? []).filter((s) => s.id !== id) }
            : todo,
        ),
      );
      break;
    }
    case 'monitor.created':
    case 'monitor.updated':
    case 'monitor.deleted': {
      // Refetch so todo/subtask deployedEnvironments stay in sync with server-side enrichment.
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      break;
    }
    case 'release.created':
    case 'release.updated': {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      break;
    }
  }
}
