import {
  DeploymentStatus,
  JenkinsBuildResult,
  MonitorResultStatus,
  TestcaseScanStatus,
} from '@todo-platform/shared-types';
import {
  isTerminalTestcaseScanStatus,
  mapMonitorResultToTestcaseScanBuildResult,
  mapMonitorResultToTestcaseScanStatus,
} from './testcase-scan-status-sync';

describe('mapMonitorResultToTestcaseScanStatus', () => {
  it('maps running monitor to scanning', () => {
    expect(
      mapMonitorResultToTestcaseScanStatus({
        status: MonitorResultStatus.RUNNING,
        message: 'running',
        metadata: { scan: { status: DeploymentStatus.IN_PROGRESS } },
      }),
    ).toBe(TestcaseScanStatus.SCANNING);
  });

  it('maps success monitor to completed', () => {
    expect(
      mapMonitorResultToTestcaseScanStatus({
        status: MonitorResultStatus.SUCCESS,
        message: 'done',
        metadata: { scan: { status: DeploymentStatus.SUCCESS } },
      }),
    ).toBe(TestcaseScanStatus.COMPLETED);
  });

  it('maps failed monitor to failed', () => {
    expect(
      mapMonitorResultToTestcaseScanStatus({
        status: MonitorResultStatus.FAILED,
        message: 'fail',
        metadata: { scan: { status: DeploymentStatus.FAIL } },
      }),
    ).toBe(TestcaseScanStatus.FAILED);
  });

  it('does not map Jenkins API auth errors to failed', () => {
    expect(
      mapMonitorResultToTestcaseScanStatus({
        status: MonitorResultStatus.FAILED,
        message: 'Jenkins API returned 401',
        metadata: { statusCode: 401 },
      }),
    ).toBeNull();
  });
});

describe('mapMonitorResultToTestcaseScanBuildResult', () => {
  it('preserves UNSTABLE from monitor metadata', () => {
    expect(
      mapMonitorResultToTestcaseScanBuildResult({
        status: MonitorResultStatus.SUCCESS,
        message: 'done',
        metadata: {
          scan: { status: DeploymentStatus.SUCCESS, result: JenkinsBuildResult.UNSTABLE },
        },
      }),
    ).toBe(JenkinsBuildResult.UNSTABLE);
  });

  it('returns null while the build is running', () => {
    expect(
      mapMonitorResultToTestcaseScanBuildResult({
        status: MonitorResultStatus.RUNNING,
        message: 'running',
        metadata: { scan: { status: DeploymentStatus.IN_PROGRESS } },
      }),
    ).toBeNull();
  });
});

describe('isTerminalTestcaseScanStatus', () => {
  it('returns true for completed and failed', () => {
    expect(isTerminalTestcaseScanStatus(TestcaseScanStatus.COMPLETED)).toBe(true);
    expect(isTerminalTestcaseScanStatus(TestcaseScanStatus.FAILED)).toBe(true);
  });

  it('returns false for scanning', () => {
    expect(isTerminalTestcaseScanStatus(TestcaseScanStatus.SCANNING)).toBe(false);
  });
});
