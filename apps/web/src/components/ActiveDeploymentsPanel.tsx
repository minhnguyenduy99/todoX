import { useEffect, useMemo, useState } from 'react';
import type { TodoDto } from '@todo-platform/shared-types';
import { DeploymentStatus } from '@todo-platform/shared-types';
import {
  collectTodayServiceDeployments,
  formatDeploymentGroupCopyText,
  groupTodayDeploymentsByEnvironment,
  groupTodayDeploymentsByService,
  type ActiveDeploymentRow,
} from '../utils/activeDeployments';
import {
  type DeploymentGroupMode,
  readDeploymentGroupModeFromStorage,
  syncDeploymentGroupModeToStorage,
} from '../utils/deploymentGroupMode';
import {
  deploymentStatusChipClassName,
  formatDeploymentCurrentStep,
  formatDeploymentDuration,
  resolveDeploymentDurationMs,
} from '../utils/deploymentDisplay';

interface ActiveDeploymentsPanelProps {
  todos: TodoDto[];
}

function DeploymentChip({
  primaryLabel,
  status,
  buildNumber,
  currentStep,
  durationMs,
  timestamp,
  buildUrl,
  nowMs,
}: {
  primaryLabel: string;
  status: DeploymentStatus;
  buildNumber: number;
  currentStep?: string | null;
  durationMs: number | null;
  timestamp?: number;
  buildUrl?: string;
  nowMs: number;
}) {
  const resolvedDurationMs = resolveDeploymentDurationMs(durationMs, status, timestamp, nowMs);
  const duration = formatDeploymentDuration(resolvedDurationMs);
  const stageLabel = formatDeploymentCurrentStep(status, currentStep);
  const titleParts = [primaryLabel, `Build #${buildNumber}`];
  if (stageLabel) titleParts.push(`Stage: ${stageLabel}`);
  if (duration) titleParts.push(duration);
  if (buildUrl) titleParts.push(buildUrl);
  const title = titleParts.join(' · ');

  const chipMeta = (
    <span className="env-chip-meta">
      {status === DeploymentStatus.IN_PROGRESS && (
        <span className="env-chip-spinner" aria-hidden="true" />
      )}
      <span className="env-chip-build">#{buildNumber}</span>
      {duration && <span className="env-chip-duration">{duration}</span>}
    </span>
  );

  const chipContent = stageLabel ? (
    <span className="env-chip-body">
      <span className="env-chip-row">
        <span
          className={`env-chip-label${status === DeploymentStatus.IN_PROGRESS ? ' env-chip-label-marquee' : ''}`}
        >
          {primaryLabel}
        </span>
        {chipMeta}
      </span>
      <span className="env-chip-step" title={stageLabel}>
        {stageLabel}
      </span>
    </span>
  ) : (
    <>
      <span
        className={`env-chip-label${status === DeploymentStatus.IN_PROGRESS ? ' env-chip-label-marquee' : ''}`}
      >
        {primaryLabel}
      </span>
      {chipMeta}
    </>
  );

  const chipClassName = `env-chip ${deploymentStatusChipClassName(status)} deployment-active-chip`;

  if (buildUrl) {
    return (
      <a
        className={chipClassName}
        href={buildUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
      >
        {chipContent}
      </a>
    );
  }

  return (
    <span className={chipClassName} title={title}>
      {chipContent}
    </span>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="copyable-uuid-icon">
      <path
        fill="currentColor"
        d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="copyable-uuid-icon">
      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

function DeploymentGroupRow({
  groupKey,
  groupLabel,
  getChipPrimaryLabel,
  deployments,
  nowMs,
}: {
  groupKey: string;
  groupLabel: string;
  getChipPrimaryLabel: (deployment: ActiveDeploymentRow) => string;
  deployments: ActiveDeploymentRow[];
  nowMs: number;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = formatDeploymentGroupCopyText(deployments);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access may be unavailable.
    }
  }

  return (
    <div className="deployment-active-row">
      <div className="deployment-active-row-header">
        <span className="deployment-active-service">{groupLabel}</span>
        <button
          type="button"
          className={`copyable-uuid copyable-uuid-icon-btn${copied ? ' copyable-uuid-icon-btn-copied' : ''}`}
          onClick={handleCopy}
          title={copied ? 'Copied!' : `Copy in-progress deployments for ${groupLabel}`}
          aria-label={copied ? 'Deployments copied' : `Copy in-progress deployments for ${groupLabel}`}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      <div className="deployment-active-chips">
        {deployments.map((deployment) => (
          <DeploymentChip
            key={`${groupKey}:${deployment.id}`}
            primaryLabel={getChipPrimaryLabel(deployment)}
            status={deployment.status}
            buildNumber={deployment.buildNumber}
            currentStep={deployment.currentStep}
            durationMs={deployment.durationMs}
            timestamp={deployment.timestamp}
            buildUrl={deployment.buildUrl}
            nowMs={nowMs}
          />
        ))}
      </div>
    </div>
  );
}

export function ActiveDeploymentsPanel({ todos }: ActiveDeploymentsPanelProps) {
  const [groupMode, setGroupMode] = useState<DeploymentGroupMode>(() =>
    readDeploymentGroupModeFromStorage(),
  );
  const rows = useMemo(() => collectTodayServiceDeployments(todos), [todos]);
  const groups = useMemo(() => {
    if (groupMode === 'env') {
      return groupTodayDeploymentsByEnvironment(rows).map((group) => ({
        key: group.environment,
        label: group.environment,
        deployments: group.deployments,
        getChipPrimaryLabel: (deployment: ActiveDeploymentRow) => deployment.serviceLabel,
      }));
    }

    return groupTodayDeploymentsByService(rows).map((group) => ({
      key: group.serviceKey,
      label: group.serviceLabel,
      deployments: group.deployments,
      getChipPrimaryLabel: (deployment: ActiveDeploymentRow) => deployment.environment,
    }));
  }, [groupMode, rows]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const hasInProgress = groups.some((group) =>
      group.deployments.some((row) => row.status === DeploymentStatus.IN_PROGRESS),
    );
    if (!hasInProgress) return;

    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [groups]);

  function handleGroupModeChange(mode: DeploymentGroupMode) {
    setGroupMode(mode);
    syncDeploymentGroupModeToStorage(mode);
  }

  return (
    <div className="deployments-panel">
      <div className="deployments-panel-header">
        <h2 className="deployments-panel-title">Today&apos;s Deployments</h2>
        <div
          className="view-toggle deployments-panel-toggle"
          role="group"
          aria-label="Deployment grouping"
        >
          <button
            type="button"
            className={`view-toggle-btn${groupMode === 'service' ? ' active' : ''}`}
            onClick={() => handleGroupModeChange('service')}
          >
            Service
          </button>
          <button
            type="button"
            className={`view-toggle-btn${groupMode === 'env' ? ' active' : ''}`}
            onClick={() => handleGroupModeChange('env')}
          >
            Env
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="deployments-panel-empty">
          <p>No deployments today</p>
        </div>
      ) : (
        <div className="deployments-active-list">
          {groups.map((group) => (
            <DeploymentGroupRow
              key={group.key}
              groupKey={group.key}
              groupLabel={group.label}
              getChipPrimaryLabel={group.getChipPrimaryLabel}
              deployments={group.deployments}
              nowMs={nowMs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
