import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AssociatedTicketDto, TodoDto } from '@todo-platform/shared-types';
import { AssociatedTicketType, TodoStatus } from '@todo-platform/shared-types';
import { localTodoSearchService } from './localTodoSearchService';

const baseTicket = (overrides: Partial<AssociatedTicketDto> = {}): AssociatedTicketDto => ({
  id: 'ticket-1',
  title: 'Payment retry bug',
  type: AssociatedTicketType.BUG,
  link: 'https://jira.example.com/browse/FB-1234',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const baseTodo = (overrides: Partial<TodoDto> = {}): TodoDto => ({
  id: 'todo-1',
  title: 'OAuth login flow',
  description: null,
  changelog: null,
  status: TodoStatus.NOT_STARTED,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('localTodoSearchService.filterTodos', () => {
  const todos = [
    baseTodo({ id: '1', title: 'OAuth login flow' }),
    baseTodo({
      id: '2',
      title: 'Deploy billing',
      associatedTickets: [baseTicket()],
    }),
    baseTodo({ id: '3', title: 'Unrelated work' }),
  ];

  it('returns the same array contents in order for empty query', () => {
    const result = localTodoSearchService.filterTodos(todos, '   ');
    assert.deepEqual(
      result.map((todo) => todo.id),
      ['1', '2', '3'],
    );
  });

  it('returns only matching todos for a query', () => {
    const result = localTodoSearchService.filterTodos(todos, 'oauth');
    assert.deepEqual(
      result.map((todo) => todo.id),
      ['1'],
    );
  });

  it('returns empty array when nothing matches', () => {
    const result = localTodoSearchService.filterTodos(todos, 'zzzz-no-match');
    assert.deepEqual(result, []);
  });
});
