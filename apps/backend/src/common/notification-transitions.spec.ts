import {
  DeploymentStatus,
  MonitorResultStatus,
  ReleaseDeploymentStatus,
  SubtaskStatus,
  TestcaseScanStatus,
} from '@todo-platform/shared-types';
import {
  isFirstMonitorTerminalTransition,
  isReleaseDeploymentTerminalTransition,
  isSubtaskTerminalTransition,
  isTestcaseScanTerminalTransition,
} from './notification-transitions';

describe('notification-transitions', () => {
  describe('isFirstMonitorTerminalTransition', () => {
    it('returns success on RUNNING to SUCCESS edge', () => {
      expect(
        isFirstMonitorTerminalTransition(
          { status: MonitorResultStatus.RUNNING, message: 'running' },
          { status: MonitorResultStatus.SUCCESS, message: 'ok' },
        ),
      ).toBe('success');
    });

    it('returns failure on RUNNING to FAILED edge', () => {
      expect(
        isFirstMonitorTerminalTransition(
          { status: MonitorResultStatus.RUNNING, message: 'running' },
          {
            status: MonitorResultStatus.FAILED,
            message: 'Deployment to staging build #52 failed',
            metadata: {
              deployment: { status: DeploymentStatus.FAIL },
            },
          },
        ),
      ).toBe('failure');
    });

    it('returns null when SUCCESS repeats', () => {
      expect(
        isFirstMonitorTerminalTransition(
          { status: MonitorResultStatus.SUCCESS, message: 'ok' },
          { status: MonitorResultStatus.SUCCESS, message: 'ok' },
        ),
      ).toBeNull();
    });

    it('returns null when still running', () => {
      expect(
        isFirstMonitorTerminalTransition(
          { status: MonitorResultStatus.RUNNING, message: 'running' },
          { status: MonitorResultStatus.RUNNING, message: 'running' },
        ),
      ).toBeNull();
    });

    it('returns null for Jenkins poll errors', () => {
      expect(
        isFirstMonitorTerminalTransition(
          { status: MonitorResultStatus.RUNNING, message: 'running' },
          {
            status: MonitorResultStatus.FAILED,
            message: 'Jenkins API returned 403',
            metadata: { statusCode: 403 },
          },
        ),
      ).toBeNull();
    });
  });

  describe('isSubtaskTerminalTransition', () => {
    it('returns success on IN_PROGRESS to COMPLETED', () => {
      expect(
        isSubtaskTerminalTransition(
          SubtaskStatus.IN_PROGRESS,
          SubtaskStatus.COMPLETED,
        ),
      ).toBe('success');
    });

    it('returns null when status unchanged', () => {
      expect(
        isSubtaskTerminalTransition(
          SubtaskStatus.COMPLETED,
          SubtaskStatus.COMPLETED,
        ),
      ).toBeNull();
    });
  });

  describe('isReleaseDeploymentTerminalTransition', () => {
    it('returns success on in_progress to successful', () => {
      expect(
        isReleaseDeploymentTerminalTransition(
          ReleaseDeploymentStatus.IN_PROGRESS,
          ReleaseDeploymentStatus.SUCCESSFUL,
        ),
      ).toBe('success');
    });

    it('returns null when successful repeats', () => {
      expect(
        isReleaseDeploymentTerminalTransition(
          ReleaseDeploymentStatus.SUCCESSFUL,
          ReleaseDeploymentStatus.SUCCESSFUL,
        ),
      ).toBeNull();
    });

    it('returns null when leaving failed for successful (poll flapping)', () => {
      expect(
        isReleaseDeploymentTerminalTransition(
          ReleaseDeploymentStatus.FAILED,
          ReleaseDeploymentStatus.SUCCESSFUL,
        ),
      ).toBeNull();
    });
  });

  describe('isTestcaseScanTerminalTransition', () => {
    it('returns success on scanning to completed', () => {
      expect(
        isTestcaseScanTerminalTransition(
          TestcaseScanStatus.SCANNING,
          TestcaseScanStatus.COMPLETED,
        ),
      ).toBe('success');
    });

    it('returns null when completed repeats', () => {
      expect(
        isTestcaseScanTerminalTransition(
          TestcaseScanStatus.COMPLETED,
          TestcaseScanStatus.COMPLETED,
        ),
      ).toBeNull();
    });
  });
});
