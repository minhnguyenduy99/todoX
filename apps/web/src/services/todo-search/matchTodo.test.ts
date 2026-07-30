import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AssociatedTicketDto, TodoDto } from '@todo-platform/shared-types';
import { AssociatedTicketType, TodoStatus } from '@todo-platform/shared-types';
import { normalizeSearchQuery, todoMatchesSearchQuery } from './matchTodo';

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

describe('normalizeSearchQuery', () => {
  it('trims and lowercases the query', () => {
    assert.equal(normalizeSearchQuery('  OAuth  '), 'oauth');
  });

  it('returns empty string for whitespace-only input', () => {
    assert.equal(normalizeSearchQuery('   '), '');
  });
});

describe('todoMatchesSearchQuery', () => {
  it('matches every todo when normalized query is empty', () => {
    const todo = baseTodo();
    assert.equal(todoMatchesSearchQuery(todo, ''), true);
    assert.equal(todoMatchesSearchQuery(todo, normalizeSearchQuery('  ')), true);
  });

  it('matches todo title case-insensitively', () => {
    const todo = baseTodo({ title: 'oauth auth flow' });
    assert.equal(todoMatchesSearchQuery(todo, normalizeSearchQuery('Auth')), true);
  });

  it('matches associated ticket title when todo title does not', () => {
    const todo = baseTodo({
      title: 'Deploy billing',
      associatedTickets: [baseTicket({ title: 'Payment retry bug' })],
    });
    assert.equal(todoMatchesSearchQuery(todo, normalizeSearchQuery('retry')), true);
  });

  it('matches ticket ID extracted from Jira link', () => {
    const todo = baseTodo({
      title: 'Deploy billing',
      associatedTickets: [baseTicket()],
    });
    assert.equal(todoMatchesSearchQuery(todo, normalizeSearchQuery('fb-123')), true);
  });

  it('matches ticket title when link has no parseable ID', () => {
    const todo = baseTodo({
      title: 'Unrelated',
      associatedTickets: [
        baseTicket({
          title: 'Payment retry bug',
          link: 'https://example.com/tickets/not-a-jira-id',
        }),
      ],
    });
    assert.equal(todoMatchesSearchQuery(todo, normalizeSearchQuery('retry')), true);
    assert.equal(todoMatchesSearchQuery(todo, normalizeSearchQuery('fb-123')), false);
  });

  it('considers only title when there are no associated tickets', () => {
    const todo = baseTodo({ title: 'OAuth login flow', associatedTickets: undefined });
    assert.equal(todoMatchesSearchQuery(todo, normalizeSearchQuery('oauth')), true);
    assert.equal(todoMatchesSearchQuery(todo, normalizeSearchQuery('fb-123')), false);
  });

  it('does not match description content', () => {
    const todo = baseTodo({
      title: 'Unrelated title',
      description: 'Contains oauth keyword in description',
    });
    assert.equal(todoMatchesSearchQuery(todo, normalizeSearchQuery('oauth')), false);
  });
});
