import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  parseDeploymentGroupMode,
  readDeploymentGroupModeFromStorage,
  syncDeploymentGroupModeToStorage,
} from './deploymentGroupMode';

const STORAGE_KEY = 'todox.deploymentGroupMode';

describe('parseDeploymentGroupMode', () => {
  it('returns service for null', () => {
    assert.equal(parseDeploymentGroupMode(null), 'service');
  });

  it('returns service for unknown values', () => {
    assert.equal(parseDeploymentGroupMode('grid'), 'service');
  });

  it('returns env when stored as env', () => {
    assert.equal(parseDeploymentGroupMode('env'), 'env');
  });

  it('returns service when stored as service', () => {
    assert.equal(parseDeploymentGroupMode('service'), 'service');
  });
});

describe('deployment group mode storage', () => {
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

  it('reads service by default', () => {
    assert.equal(readDeploymentGroupModeFromStorage(), 'service');
  });

  it('persists and reads env', () => {
    syncDeploymentGroupModeToStorage('env');
    assert.equal(storage.get(STORAGE_KEY), 'env');
    assert.equal(readDeploymentGroupModeFromStorage(), 'env');
  });

  it('persists and reads service', () => {
    syncDeploymentGroupModeToStorage('service');
    assert.equal(readDeploymentGroupModeFromStorage(), 'service');
  });
});
