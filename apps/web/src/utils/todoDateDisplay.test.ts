import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTodoStatusUpdateDate } from './todoDateDisplay';

describe('formatTodoStatusUpdateDate', () => {
  it('formats as day and short month', () => {
    assert.equal(formatTodoStatusUpdateDate('2026-07-30T14:00:00.000Z'), '30 Jul');
  });

  it('returns empty string for invalid input', () => {
    assert.equal(formatTodoStatusUpdateDate('not-a-date'), '');
  });
});
