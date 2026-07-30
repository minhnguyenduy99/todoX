import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TodoDto } from '@todo-platform/shared-types';
import { TodoStatus } from '@todo-platform/shared-types';
import {
  filterTodosByService,
  parseServiceFilter,
  serviceFilterToQueryValue,
} from './serviceFilter';

const baseTodo = (overrides: Partial<TodoDto> = {}): TodoDto => ({
  id: 'todo-1',
  title: 'Test',
  description: null,
  changelog: null,
  status: TodoStatus.NOT_STARTED,
  statusUpdateDate: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const baseService = (overrides: Partial<{ id: string; keyName: string; displayName: string }> = {}) => ({
  id: 's1',
  keyName: 'billing-api',
  displayName: 'Billing',
  deployments: [],
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('parseServiceFilter', () => {
  it('returns all for empty search', () => {
    assert.deepEqual(parseServiceFilter(''), { kind: 'all' });
  });

  it('returns all for service=all', () => {
    assert.deepEqual(parseServiceFilter('?service=all'), { kind: 'all' });
  });

  it('returns unassigned for service=unassigned', () => {
    assert.deepEqual(parseServiceFilter('?service=unassigned'), { kind: 'unassigned' });
  });

  it('returns service when key is known', () => {
    assert.deepEqual(parseServiceFilter('?service=billing-api', new Set(['billing-api'])), {
      kind: 'service',
      keyName: 'billing-api',
    });
  });

  it('returns all for unknown key when known set provided', () => {
    assert.deepEqual(parseServiceFilter('?service=deleted-svc', new Set(['billing-api'])), {
      kind: 'all',
    });
  });
});

describe('serviceFilterToQueryValue', () => {
  it('returns null for all', () => {
    assert.equal(serviceFilterToQueryValue({ kind: 'all' }), null);
  });

  it('returns unassigned token', () => {
    assert.equal(serviceFilterToQueryValue({ kind: 'unassigned' }), 'unassigned');
  });
});

describe('filterTodosByService', () => {
  const todos = [
    baseTodo({ id: '1', service: baseService({ id: 's1', keyName: 'billing-api', displayName: 'Billing' }) }),
    baseTodo({ id: '2', service: baseService({ id: 's2', keyName: 'auth-api', displayName: 'Auth' }) }),
    baseTodo({ id: '3', service: null }),
  ];

  it('returns all todos for all filter', () => {
    assert.equal(filterTodosByService(todos, { kind: 'all' }).length, 3);
  });

  it('returns unassigned todos only', () => {
    const result = filterTodosByService(todos, { kind: 'unassigned' });
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, '3');
  });

  it('returns matching service todos only', () => {
    const result = filterTodosByService(todos, { kind: 'service', keyName: 'billing-api' });
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, '1');
  });
});
