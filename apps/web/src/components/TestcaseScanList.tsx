import type { TestcaseScanDto } from '@todo-platform/shared-types';
import { TestcaseScanStatus } from '@todo-platform/shared-types';
import {
  formatTestcaseScanResultLabel,
  testcaseScanResultBadgeClassName,
  testcaseScanStatusChipClassName,
} from '../utils/testcaseScanDisplay';

interface TestcaseScanListProps {
  scans: TestcaseScanDto[];
  compact?: boolean;
  layout?: 'chips' | 'lines';
}

function ScanResultBadge({ scan }: { scan: TestcaseScanDto }) {
  const resultLabel = formatTestcaseScanResultLabel(scan);

  return (
    <span className={`badge badge-sm ${testcaseScanResultBadgeClassName(scan)}`}>
      {resultLabel}
    </span>
  );
}

function ScanChipRow({
  scan,
  className,
}: {
  scan: TestcaseScanDto;
  className: string;
}) {
  const resultLabel = formatTestcaseScanResultLabel(scan);

  const content = (
    <>
      {scan.status === TestcaseScanStatus.SCANNING && !scan.buildResult && (
        <span className="testcase-scan-spinner" aria-hidden="true" />
      )}
      <span className="testcase-scan-name">{scan.name}</span>
      <span className="testcase-scan-status">{resultLabel}</span>
    </>
  );

  if (scan.jobUrl) {
    return (
      <a
        className={className}
        href={scan.jobUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`${scan.name} · ${resultLabel}`}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </a>
    );
  }

  return (
    <span className={className} title={`${scan.name} · ${resultLabel}`}>
      {content}
    </span>
  );
}

function ScanLineRow({ scan }: { scan: TestcaseScanDto }) {
  const resultLabel = formatTestcaseScanResultLabel(scan);
  const nameContent = (
    <>
      {scan.status === TestcaseScanStatus.SCANNING && !scan.buildResult && (
        <span className="testcase-scan-spinner" aria-hidden="true" />
      )}
      <span className="testcase-scan-name">{scan.name}</span>
    </>
  );

  return (
    <div className="testcase-scan-line-row">
      {scan.jobUrl ? (
        <a
          className="testcase-scan-line-link"
          href={scan.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`${scan.name} · ${resultLabel}`}
          onClick={(e) => e.stopPropagation()}
        >
          {nameContent}
        </a>
      ) : (
        <div className="testcase-scan-line-name">{nameContent}</div>
      )}
      <ScanResultBadge scan={scan} />
    </div>
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
          <ScanLineRow key={scan.id} scan={scan} />
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
        <ScanChipRow
          key={scan.id}
          scan={scan}
          className={`testcase-scan-chip ${testcaseScanStatusChipClassName(scan.status)}`}
        />
      ))}
    </div>
  );
}
