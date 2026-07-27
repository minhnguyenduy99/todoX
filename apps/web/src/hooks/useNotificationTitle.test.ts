import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatNotificationTitle } from './useNotificationTitle.ts';

describe('formatNotificationTitle', () => {
  it('prefixes unread count when greater than zero', () => {
    assert.equal(formatNotificationTitle(3), '(3) Todo Platform');
  });

  it('returns base title when unread count is zero', () => {
    assert.equal(formatNotificationTitle(0), 'Todo Platform');
  });
});
