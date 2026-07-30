import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TodoDto } from '@todo-platform/shared-types';
import { TodoStatus } from '@todo-platform/shared-types';
import {
  STALE_TESTING_THRESHOLD_MS,
  filterTodosStaleInTesting,
  isTodoStaleInTesting,
} from './staleTestingFilter';

const baseTodo = (overrides: Partial<TodoDto> = {}): TodoDto => ({
  id: 'todo-1',
  title: 'Test',
  description: null,
  changelog: null,
  status: TodoStatus.TESTING,
  statusUpdateDate: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('isTodoStaleInTesting', () => {
  const nowMs = Date.parse('2026-07-30T12:00:00.000Z');

  it('includes Testing todos at or beyond the 72h threshold', () => {
    const staleAt = new Date(nowMs - STALE_TESTING_THRESHOLD_MS).toISOString();
    assert.equal(isTodoStaleInTesting(baseTodo({ statusUpdateDate: staleAt }), nowMs), true);
  });

  it('includes Testing todos exactly 72h old', () => {
    const exactlyAt = new Date(nowMs - STALE_TESTING_THRESHOLD_MS).toISOString();
    assert.equal(isTodoStaleInTesting(baseTodo({ statusUpdateDate: exactlyAt }), nowMs), true);
  });

  it('excludes Testing todos just under 72h old', () => {
    const freshAt = new Date(nowMs - STALE_TESTING_THRESHOLD_MS + 60_000).toISOString();
    assert.equal(isTodoStaleInTesting(baseTodo({ statusUpdateDate: freshAt }), nowMs), false);
  });

  it('excludes non-Testing todos even when statusUpdateDate is old', () => {
    const oldAt = new Date(nowMs - STALE_TESTING_THRESHOLD_MS * 2).toISOString();
    assert.equal(
      isTodoStaleInTesting(
        baseTodo({ status: TodoStatus.WAIT_FOR_STAGING, statusUpdateDate: oldAt }),
        nowMs,
      ),
      false,
    );
  });

  it('excludes todos with missing statusUpdateDate', () => {
    assert.equal(
      isTodoStaleInTesting(baseTodo({ statusUpdateDate: '' as unknown as string }), nowMs),
      false,
    );
  });
});

describe('filterTodosStaleInTesting', () => {
  const nowMs = Date.parse('2026-07-30T12:00:00.000Z');
  const staleAt = new Date(nowMs - STALE_TESTING_THRESHOLD_MS).toISOString();
  const freshAt = new Date(nowMs - STALE_TESTING_THRESHOLD_MS + 60_000).toISOString();

  const todos = [
    baseTodo({ id: 'stale', statusUpdateDate: staleAt }),
    baseTodo({ id: 'fresh', statusUpdateDate: freshAt }),
    baseTodo({
      id: 'other-status',
      status: TodoStatus.IN_PROGRESS,
      statusUpdateDate: staleAt,
    }),
  ];

  it('returns all todos when disabled', () => {
    assert.deepEqual(filterTodosStaleInTesting(todos, false, nowMs), todos);
  });

  it('returns only stale Testing todos when enabled', () => {
    assert.deepEqual(
      filterTodosStaleInTesting(todos, true, nowMs).map((todo) => todo.id),
      ['stale'],
    );
  });
});
