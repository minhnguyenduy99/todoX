import {
  DeploymentStatus,
  JenkinsBuildResult,
  MonitorResultStatus,
  TestcaseScanStatus,
  type MonitorResult,
} from '@todo-platform/shared-types';

const JENKINS_BUILD_RESULTS = new Set<string>(Object.values(JenkinsBuildResult));

export function isJenkinsBuildResult(value: string): value is JenkinsBuildResult {
  return JENKINS_BUILD_RESULTS.has(value);
}

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

export function mapMonitorResultToTestcaseScanBuildResult(
  result: MonitorResult,
): JenkinsBuildResult | null {
  const scan = result.metadata?.scan as
    | { result?: string | null; status?: DeploymentStatus }
    | undefined;
  if (scan?.result && isJenkinsBuildResult(scan.result)) {
    return scan.result;
  }

  if (
    result.status === MonitorResultStatus.RUNNING ||
    scan?.status === DeploymentStatus.IN_PROGRESS
  ) {
    return null;
  }

  if (scan?.status === DeploymentStatus.SUCCESS) {
    return JenkinsBuildResult.SUCCESS;
  }

  if (scan?.status === DeploymentStatus.FAIL) {
    return JenkinsBuildResult.FAILURE;
  }

  return null;
}

export function isTerminalTestcaseScanStatus(status: TestcaseScanStatus): boolean {
  return (
    status === TestcaseScanStatus.COMPLETED || status === TestcaseScanStatus.FAILED
  );
}
