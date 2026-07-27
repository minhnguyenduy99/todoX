import { useEffect, useMemo, useState } from 'react';
import type { TodoDto } from '@todo-platform/shared-types';
import { DeploymentStatus } from '@todo-platform/shared-types';
import {
  collectTodayServiceDeployments,
  groupTodayDeploymentsByService,
  type ActiveDeploymentRow,
} from '../utils/activeDeployments';
import {
  deploymentStatusChipClassName,
  formatDeploymentDuration,
  resolveDeploymentDurationMs,
} from '../utils/deploymentDisplay';

interface ActiveDeploymentsPanelProps {
  todos: TodoDto[];
}

function DeploymentChip({
  environment,
  status,
  buildNumber,
  durationMs,
  timestamp,
  buildUrl,
  nowMs,
}: {
  environment: string;
  status: DeploymentStatus;
  buildNumber: number;
  durationMs: number | null;
  timestamp?: number;
  buildUrl?: string;
  nowMs: number;
}) {
  const resolvedDurationMs = resolveDeploymentDurationMs(durationMs, status, timestamp, nowMs);
  const duration = formatDeploymentDuration(resolvedDurationMs);
  const chipClassName = `env-chip ${deploymentStatusChipClassName(status)} deployment-active-chip`;
  const titleParts = [environment, `Build #${buildNumber}`];
  if (duration) titleParts.push(duration);
  if (buildUrl) titleParts.push(buildUrl);
  const title = titleParts.join(' · ');

  const chipContent = (
    <>
      <span
        className={`env-chip-label${status === DeploymentStatus.IN_PROGRESS ? ' env-chip-label-marquee' : ''}`}
      >
        {environment}
      </span>
      <span className="env-chip-meta">
        {status === DeploymentStatus.IN_PROGRESS && (
          <span className="env-chip-spinner" aria-hidden="true" />
        )}
        <span className="env-chip-build">#{buildNumber}</span>
        {duration && <span className="env-chip-duration">{duration}</span>}
      </span>
    </>
  );

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

function ServiceDeploymentRow({
  serviceLabel,
  deployments,
  nowMs,
}: {
  serviceLabel: string;
  deployments: ActiveDeploymentRow[];
  nowMs: number;
}) {
  return (
    <div className="deployment-active-row">
      <span className="deployment-active-service">{serviceLabel}</span>
      <div className="deployment-active-chips">
        {deployments.map((deployment) => (
          <DeploymentChip
            key={deployment.id}
            environment={deployment.environment}
            status={deployment.status}
            buildNumber={deployment.buildNumber}
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
  const groups = useMemo(() => {
    const rows = collectTodayServiceDeployments(todos);
    return groupTodayDeploymentsByService(rows);
  }, [todos]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const hasInProgress = groups.some((group) =>
      group.deployments.some((row) => row.status === DeploymentStatus.IN_PROGRESS),
    );
    if (!hasInProgress) return;

    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [groups]);

  return (
    <div className="deployments-panel">
      <h2 className="deployments-panel-title">Today&apos;s Deployments</h2>

      {groups.length === 0 ? (
        <div className="deployments-panel-empty">
          <p>No deployments today</p>
        </div>
      ) : (
        <div className="deployments-active-list">
          {groups.map((group) => (
            <ServiceDeploymentRow
              key={group.serviceKey}
              serviceLabel={group.serviceLabel}
              deployments={group.deployments}
              nowMs={nowMs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
