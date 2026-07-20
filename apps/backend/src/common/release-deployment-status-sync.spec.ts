import {
  MonitorResultStatus,
  ReleaseDeploymentStatus,
  ReleaseStatus,
  ReleaseType,
  type MonitorResult,
} from '@todo-platform/shared-types';
import {
  aggregateReleaseStatus,
  mapMonitorResultToDeploymentStatus,
  resolveServiceOutcomes,
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

    it('returns partial_success when at least one service succeeds but not all', () => {
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([[a, ReleaseDeploymentStatus.SUCCESSFUL]]),
        ),
      ).toBe(ReleaseStatus.PARTIAL_SUCCESS);
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([
            [a, ReleaseDeploymentStatus.SUCCESSFUL],
            [b, ReleaseDeploymentStatus.FAILED],
          ]),
        ),
      ).toBe(ReleaseStatus.PARTIAL_SUCCESS);
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([
            [a, ReleaseDeploymentStatus.SUCCESSFUL],
            [b, ReleaseDeploymentStatus.IN_PROGRESS],
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

    it('stays in_progress when no services have succeeded yet', () => {
      expect(aggregateReleaseStatus([a, b], new Map())).toBe(
        ReleaseStatus.IN_PROGRESS,
      );
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([
            [a, ReleaseDeploymentStatus.FAILED],
            [b, ReleaseDeploymentStatus.IN_PROGRESS],
          ]),
        ),
      ).toBe(ReleaseStatus.IN_PROGRESS);
      expect(
        aggregateReleaseStatus(
          [a, b],
          new Map([[a, ReleaseDeploymentStatus.PENDING]]),
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

  describe('resolveServiceOutcomes', () => {
    const a = 'svc-a';
    const b = 'svc-b';

    it('treats all staging member todos COMPLETED as service success', () => {
      const outcomes = resolveServiceOutcomes({
        releaseType: ReleaseType.STAGING,
        memberServiceIds: [a, b],
        deploymentsByServiceId: new Map(),
        membersByServiceId: new Map([
          [a, { activeStatuses: ['COMPLETED'], archivedCount: 0 }],
          [b, { activeStatuses: ['COMPLETED'], archivedCount: 0 }],
        ]),
      });
      expect(aggregateReleaseStatus([a, b], outcomes)).toBe(ReleaseStatus.SUCCESSFUL);
    });

    it('becomes partial_success when only some staging services are COMPLETED', () => {
      const outcomes = resolveServiceOutcomes({
        releaseType: ReleaseType.STAGING,
        memberServiceIds: [a, b],
        deploymentsByServiceId: new Map(),
        membersByServiceId: new Map([
          [a, { activeStatuses: ['COMPLETED'], archivedCount: 0 }],
          [b, { activeStatuses: ['WAIT_FOR_STAGING'], archivedCount: 0 }],
        ]),
      });
      expect(aggregateReleaseStatus([a, b], outcomes)).toBe(
        ReleaseStatus.PARTIAL_SUCCESS,
      );
    });

    it('treats fully archived prod members as service success', () => {
      const outcomes = resolveServiceOutcomes({
        releaseType: ReleaseType.PROD,
        memberServiceIds: [a, b],
        deploymentsByServiceId: new Map(),
        membersByServiceId: new Map([
          [a, { activeStatuses: [], archivedCount: 1 }],
          [b, { activeStatuses: [], archivedCount: 2 }],
        ]),
      });
      expect(aggregateReleaseStatus([a, b], outcomes)).toBe(ReleaseStatus.SUCCESSFUL);
    });
  });
});
