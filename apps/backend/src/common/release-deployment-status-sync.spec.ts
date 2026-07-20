import {
  MonitorResultStatus,
  ReleaseDeploymentStatus,
  ReleaseStatus,
  type MonitorResult,
} from '@todo-platform/shared-types';
import {
  aggregateReleaseStatus,
  mapMonitorResultToDeploymentStatus,
  shouldApplyFirstSuccessSideEffect,
} from './release-deployment-status-sync';

describe('release-deployment-status-sync', () => {
  describe('mapMonitorResultToDeploymentStatus', () => {
    it('maps success/failed/running and null', () => {
      expect(
        mapMonitorResultToDeploymentStatus({
          status: MonitorResultStatus.SUCCESS,
          message: 'ok',
        }),
      ).toBe(ReleaseDeploymentStatus.SUCCESSFUL);
      expect(
        mapMonitorResultToDeploymentStatus({
          status: MonitorResultStatus.FAILED,
          message: 'fail',
        }),
      ).toBe(ReleaseDeploymentStatus.FAILED);
      expect(
        mapMonitorResultToDeploymentStatus({
          status: MonitorResultStatus.RUNNING,
          message: 'run',
        }),
      ).toBe(ReleaseDeploymentStatus.IN_PROGRESS);
      expect(mapMonitorResultToDeploymentStatus(null)).toBe(
        ReleaseDeploymentStatus.PENDING,
      );
    });
  });

  describe('aggregateReleaseStatus', () => {
    const a = 'svc-a';
    const b = 'svc-b';

    it('returns successful when all member services succeed', () => {
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([
            [a, ReleaseDeploymentStatus.SUCCESSFUL],
            [b, ReleaseDeploymentStatus.SUCCESSFUL],
          ]),
        ),
      ).toBe(ReleaseStatus.SUCCESSFUL);
    });

    it('returns partial_success for mixed terminal outcomes', () => {
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([
            [a, ReleaseDeploymentStatus.SUCCESSFUL],
            [b, ReleaseDeploymentStatus.FAILED],
          ]),
        ),
      ).toBe(ReleaseStatus.PARTIAL_SUCCESS);
    });

    it('returns failed when all member services fail', () => {
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([
            [a, ReleaseDeploymentStatus.FAILED],
            [b, ReleaseDeploymentStatus.FAILED],
          ]),
        ),
      ).toBe(ReleaseStatus.FAILED);
    });

    it('stays in_progress when a member service has no deployment', () => {
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([[a, ReleaseDeploymentStatus.SUCCESSFUL]]),
        ),
      ).toBe(ReleaseStatus.IN_PROGRESS);
    });

    it('returns not_started when no deployments exist', () => {
      expect(aggregateReleaseStatus([a, b], new Map())).toBe(
        ReleaseStatus.NOT_STARTED,
      );
    });

    it('stays in_progress while any deployment is non-terminal', () => {
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([
            [a, ReleaseDeploymentStatus.SUCCESSFUL],
            [b, ReleaseDeploymentStatus.IN_PROGRESS],
          ]),
        ),
      ).toBe(ReleaseStatus.IN_PROGRESS);
    });
  });

  describe('shouldApplyFirstSuccessSideEffect', () => {
    it('returns true only on first transition to successful', () => {
      expect(
        shouldApplyFirstSuccessSideEffect(
          ReleaseDeploymentStatus.FAILED,
          ReleaseDeploymentStatus.SUCCESSFUL,
        ),
      ).toBe(true);
      expect(
        shouldApplyFirstSuccessSideEffect(
          ReleaseDeploymentStatus.IN_PROGRESS,
          ReleaseDeploymentStatus.SUCCESSFUL,
        ),
      ).toBe(true);
      expect(
        shouldApplyFirstSuccessSideEffect(
          ReleaseDeploymentStatus.SUCCESSFUL,
          ReleaseDeploymentStatus.SUCCESSFUL,
        ),
      ).toBe(false);
      expect(
        shouldApplyFirstSuccessSideEffect(
          ReleaseDeploymentStatus.PENDING,
          ReleaseDeploymentStatus.FAILED,
        ),
      ).toBe(false);
    });
  });
});
