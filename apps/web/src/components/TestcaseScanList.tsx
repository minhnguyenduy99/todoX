import type { TestcaseScanDto } from '@todo-platform/shared-types';
import { TestcaseScanStatus } from '@todo-platform/shared-types';

interface TestcaseScanListProps {
  scans: TestcaseScanDto[];
  compact?: boolean;
  layout?: 'chips' | 'lines';
}

function scanStatusClassName(status: TestcaseScanStatus): string {
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

function scanStatusLabel(status: TestcaseScanStatus): string {
  switch (status) {
    case TestcaseScanStatus.SCANNING:
      return 'scanning';
    case TestcaseScanStatus.COMPLETED:
      return 'completed';
    case TestcaseScanStatus.FAILED:
      return 'failed';
    default:
      return status;
  }
}

function ScanRow({
  scan,
  className,
  showStatus = true,
}: {
  scan: TestcaseScanDto;
  className: string;
  showStatus?: boolean;
}) {
  const content = (
    <>
      {scan.status === TestcaseScanStatus.SCANNING && (
        <span className="testcase-scan-spinner" aria-hidden="true" />
      )}
      <span className="testcase-scan-name">{scan.name}</span>
      {showStatus && (
        <span className="testcase-scan-status">{scanStatusLabel(scan.status)}</span>
      )}
    </>
  );

  if (scan.jobUrl) {
    return (
      <a
        className={className}
        href={scan.jobUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`${scan.name} · ${scanStatusLabel(scan.status)}`}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </a>
    );
  }

  return (
    <span className={className} title={`${scan.name} · ${scanStatusLabel(scan.status)}`}>
      {content}
    </span>
  );
}

export function TestcaseScanList({
  scans,
  compact = false,
  layout = 'chips',
}: TestcaseScanListProps) {
  if (scans.length === 0) return null;

  if (layout === 'lines') {
    return (
      <div className="testcase-scan-lines" title="Testcase scan history">
        {scans.map((scan) => (
          <ScanRow
            key={scan.id}
            scan={scan}
            className={`testcase-scan-line testcase-scan-chip ${scanStatusClassName(scan.status)}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`testcase-scan-list${compact ? ' testcase-scan-list-compact' : ''}`}
      title="Testcase scan history"
    >
      {scans.map((scan) => (
        <ScanRow
          key={scan.id}
          scan={scan}
          className={`testcase-scan-chip ${scanStatusClassName(scan.status)}`}
        />
      ))}
    </div>
  );
}

export function getActiveTestcaseScans(
  scans: TestcaseScanDto[] | undefined,
): TestcaseScanDto[] {
  return (scans ?? []).filter((scan) => scan.status === TestcaseScanStatus.SCANNING);
}

export function hasActiveTestcaseScan(scans: TestcaseScanDto[] | undefined): boolean {
  return getActiveTestcaseScans(scans).length > 0;
}
