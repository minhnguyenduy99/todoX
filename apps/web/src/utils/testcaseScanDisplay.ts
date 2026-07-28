import {
  JenkinsBuildResult,
  TestcaseScanStatus,
  type TestcaseScanDto,
} from '@todo-platform/shared-types';

export function formatJenkinsBuildResult(result: JenkinsBuildResult): string {
  switch (result) {
    case JenkinsBuildResult.SUCCESS:
      return 'Stable';
    case JenkinsBuildResult.UNSTABLE:
      return 'Unstable';
    case JenkinsBuildResult.FAILURE:
      return 'Failed';
    case JenkinsBuildResult.ABORTED:
      return 'Aborted';
    default:
      return result;
  }
}

/** Popup label: Jenkins build result when finished; Scanning while the job runs. */
export function formatTestcaseScanResultLabel(scan: TestcaseScanDto): string {
  if (scan.buildResult) {
    return formatJenkinsBuildResult(scan.buildResult);
  }

  if (scan.status === TestcaseScanStatus.SCANNING) {
    return 'Scanning';
  }

  if (scan.status === TestcaseScanStatus.FAILED) {
    return 'Failed';
  }

  return 'Completed';
}

export function testcaseScanResultBadgeClassName(scan: TestcaseScanDto): string {
  if (scan.buildResult) {
    switch (scan.buildResult) {
      case JenkinsBuildResult.SUCCESS:
        return 'badge-green';
      case JenkinsBuildResult.UNSTABLE:
        return 'badge-yellow';
      case JenkinsBuildResult.FAILURE:
      case JenkinsBuildResult.ABORTED:
        return 'badge-red';
      default:
        return 'badge-gray';
    }
  }

  if (scan.status === TestcaseScanStatus.SCANNING) {
    return 'badge-yellow';
  }

  if (scan.status === TestcaseScanStatus.FAILED) {
    return 'badge-red';
  }

  return 'badge-green';
}

export function testcaseScanStatusChipClassName(
  status: TestcaseScanStatus,
): string {
  switch (status) {
    case TestcaseScanStatus.SCANNING:
      return 'testcase-scan-chip-scanning';
    case TestcaseScanStatus.COMPLETED:
      return 'testcase-scan-chip-completed';
    case TestcaseScanStatus.FAILED:
      return 'testcase-scan-chip-failed';
    default:
      return '';
  }
}
