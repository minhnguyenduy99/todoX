import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DeploymentStatus } from '@todo-platform/shared-types';
import {
  formatDeploymentDuration,
  resolveDeploymentDurationMs,
} from './deploymentDisplay';

describe('deploymentDisplay', () => {
  it('formats duration strings', () => {
    assert.equal(formatDeploymentDuration(null), null);
    assert.equal(formatDeploymentDuration(45_000), '45s');
    assert.equal(formatDeploymentDuration(125_000), '2m 5s');
  });

  it('derives elapsed duration from timestamp for in-progress builds', () => {
    const now = 1_800_000_000_000;
    assert.equal(
      resolveDeploymentDurationMs(
        null,
        DeploymentStatus.IN_PROGRESS,
        now - 90_000,
        now,
      ),
      90_000,
    );
  });

  it('prefers explicit duration over timestamp fallback', () => {
    const now = 1_800_000_000_000;
    assert.equal(
      resolveDeploymentDurationMs(60_000, DeploymentStatus.IN_PROGRESS, now - 90_000, now),
      60_000,
    );
  });
});
