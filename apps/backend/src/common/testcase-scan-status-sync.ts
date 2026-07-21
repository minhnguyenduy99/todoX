import {
  DeploymentStatus,
  MonitorResultStatus,
  TestcaseScanStatus,
  type MonitorResult,
} from '@todo-platform/shared-types';

export function mapMonitorResultToTestcaseScanStatus(
  result: MonitorResult,
): TestcaseScanStatus | null {
  const scan = result.metadata?.scan as { status?: DeploymentStatus } | undefined;
  const status = scan?.status;

  if (status === DeploymentStatus.SUCCESS) {
    return TestcaseScanStatus.COMPLETED;
  }

  if (status === DeploymentStatus.FAIL) {
    return TestcaseScanStatus.FAILED;
  }

  if (
    result.status === MonitorResultStatus.RUNNING ||
    status === DeploymentStatus.IN_PROGRESS
  ) {
    return TestcaseScanStatus.SCANNING;
  }

  if (result.status === MonitorResultStatus.SUCCESS) {
    return TestcaseScanStatus.COMPLETED;
  }

  // Poll/config errors (401, missing auth, network) must not mark the scan failed.
  return null;
}

export function isTerminalTestcaseScanStatus(status: TestcaseScanStatus): boolean {
  return (
    status === TestcaseScanStatus.COMPLETED || status === TestcaseScanStatus.FAILED
  );
}
