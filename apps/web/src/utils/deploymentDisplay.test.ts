import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DeploymentStatus,
  ReleaseDeploymentStatus,
  ReleaseType,
} from '@todo-platform/shared-types';
import {
  deploymentStatusChipClassName,
  formatDeploymentCurrentStep,
  formatDeploymentDuration,
  releaseDeploymentStatusChipClassName,
  resolveDeploymentDurationMs,
  resolveJenkinsBuildUrl,
  resolveReleaseDeploymentBuildUrl,
  todoDeployedEnvironmentChipClassName,
} from './deploymentDisplay';

describe('deploymentDisplay', () => {
  it('formats duration strings', () => {
    assert.equal(formatDeploymentDuration(null), null);
    assert.equal(formatDeploymentDuration(45_000), '45s');
    assert.equal(formatDeploymentDuration(125_000), '2m 5s');
  });

  it('formats current step only for in-progress deployments', () => {
    assert.equal(
      formatDeploymentCurrentStep(DeploymentStatus.IN_PROGRESS, ' Deploy '),
      'Deploy',
    );
    assert.equal(
      formatDeploymentCurrentStep(DeploymentStatus.SUCCESS, 'Deploy'),
      null,
    );
    assert.equal(formatDeploymentCurrentStep(DeploymentStatus.IN_PROGRESS, '   '), null);
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

  it('maps deployment status to chip classes', () => {
    assert.equal(
      deploymentStatusChipClassName(DeploymentStatus.IN_PROGRESS),
      'env-chip-status-in-progress',
    );
    assert.equal(
      deploymentStatusChipClassName(DeploymentStatus.SUCCESS),
      'env-chip-status-success',
    );
    assert.equal(
      deploymentStatusChipClassName(DeploymentStatus.FAIL),
      'env-chip-status-fail',
    );
  });

  it('maps release deployment status to chip classes', () => {
    assert.equal(
      releaseDeploymentStatusChipClassName(ReleaseDeploymentStatus.IN_PROGRESS),
      'env-chip-status-in-progress',
    );
    assert.equal(
      releaseDeploymentStatusChipClassName(ReleaseDeploymentStatus.SUCCESSFUL),
      'env-chip-status-success',
    );
    assert.equal(
      releaseDeploymentStatusChipClassName(ReleaseDeploymentStatus.FAILED),
      'env-chip-status-fail',
    );
  });

  it('uses green for env-only todo chips', () => {
    assert.equal(
      todoDeployedEnvironmentChipClassName(undefined),
      'env-chip-status-success',
    );
  });

  it('resolves Jenkins build URLs', () => {
    assert.equal(
      resolveJenkinsBuildUrl(
        'https://jenkins.example/job/my-job/',
        42,
      ),
      'https://jenkins.example/job/my-job/42/',
    );
    assert.equal(
      resolveReleaseDeploymentBuildUrl({
        id: 'dep-1',
        releaseId: 'rel-1',
        serviceId: 'svc-1',
        serviceKeyName: 'billing',
        environment: ReleaseType.STAGING,
        jobUrl: 'https://jenkins.example/job/staging',
        buildNumber: 10,
        status: ReleaseDeploymentStatus.SUCCESSFUL,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      'https://jenkins.example/job/staging/10/',
    );
  });
});
