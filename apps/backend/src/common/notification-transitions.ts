import {
  MonitorResultStatus,
  ReleaseDeploymentStatus,
  SubtaskStatus,
  TestcaseScanStatus,
  type MonitorResult,
} from '@todo-platform/shared-types';
import { isTerminalTestcaseScanStatus } from './testcase-scan-status-sync';

export type TerminalOutcome = 'success' | 'failure';

export function isFirstMonitorTerminalTransition(
  previous: MonitorResult | null,
  next: MonitorResult,
): TerminalOutcome | null {
  const isTerminal =
    next.status === MonitorResultStatus.SUCCESS ||
    next.status === MonitorResultStatus.FAILED;
  if (!isTerminal) return null;
  if (previous?.status === next.status) return null;
  return next.status === MonitorResultStatus.SUCCESS ? 'success' : 'failure';
}

export function isSubtaskTerminalTransition(
  previous: SubtaskStatus,
  next: SubtaskStatus,
): TerminalOutcome | null {
  if (previous === next) return null;
  if (next === SubtaskStatus.COMPLETED) return 'success';
  if (next === SubtaskStatus.FAILED) return 'failure';
  return null;
}

export function isReleaseDeploymentTerminalTransition(
  previous: ReleaseDeploymentStatus,
  next: ReleaseDeploymentStatus,
): TerminalOutcome | null {
  if (previous === next) return null;
  if (next === ReleaseDeploymentStatus.SUCCESSFUL) return 'success';
  if (next === ReleaseDeploymentStatus.FAILED) return 'failure';
  return null;
}

export function isTestcaseScanTerminalTransition(
  previous: TestcaseScanStatus,
  next: TestcaseScanStatus,
): TerminalOutcome | null {
  if (isTerminalTestcaseScanStatus(previous)) return null;
  if (!isTerminalTestcaseScanStatus(next)) return null;
  if (next === TestcaseScanStatus.COMPLETED) return 'success';
  if (next === TestcaseScanStatus.FAILED) return 'failure';
  return null;
}
