import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  parseTodoViewMode,
  readTodoViewModeFromStorage,
  syncTodoViewModeToStorage,
} from './todoViewMode';

const STORAGE_KEY = 'todox.todoViewMode';

describe('parseTodoViewMode', () => {
  it('returns list for null', () => {
    assert.equal(parseTodoViewMode(null), 'list');
  });

  it('returns list for unknown values', () => {
    assert.equal(parseTodoViewMode('grid'), 'list');
  });

  it('returns kanban when stored as kanban', () => {
    assert.equal(parseTodoViewMode('kanban'), 'kanban');
  });

  it('returns list when stored as list', () => {
    assert.equal(parseTodoViewMode('list'), 'list');
  });
});

describe('todo view mode storage', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('reads list by default', () => {
    assert.equal(readTodoViewModeFromStorage(), 'list');
  });

  it('persists and reads kanban', () => {
    syncTodoViewModeToStorage('kanban');
    assert.equal(storage.get(STORAGE_KEY), 'kanban');
    assert.equal(readTodoViewModeFromStorage(), 'kanban');
  });

  it('persists and reads list', () => {
    syncTodoViewModeToStorage('list');
    assert.equal(readTodoViewModeFromStorage(), 'list');
  });
});
