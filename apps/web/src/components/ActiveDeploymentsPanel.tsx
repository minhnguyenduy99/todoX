import { useEffect, useMemo, useState } from 'react';
import type { TodoDto } from '@todo-platform/shared-types';
import { DeploymentStatus } from '@todo-platform/shared-types';
import { collectTodayServiceDeployments } from '../utils/activeDeployments';
import {
  formatDeploymentDuration,
  resolveDeploymentDurationMs,
} from '../utils/deploymentDisplay';

interface ActiveDeploymentsPanelProps {
  todos: TodoDto[];
}

function envChipClassName(env: string): string {
  switch (env) {
    case 'dev':
      return 'env-chip-dev';
    case 'uat':
      return 'env-chip-uat';
    case 'uat-main':
      return 'env-chip-uat-main';
    case 'staging':
      return 'env-chip-staging';
    default:
      return 'env-chip-default';
  }
}

function deploymentChipClassName(status: DeploymentStatus): string {
  switch (status) {
    case DeploymentStatus.IN_PROGRESS:
      return 'env-chip-deploying';
    case DeploymentStatus.SUCCESS:
      return 'env-chip-deploy-success';
    case DeploymentStatus.FAIL:
      return 'env-chip-deploy-fail';
    default:
      return '';
  }
}

function DeploymentRow({
  serviceLabel,
  environment,
  status,
  buildNumber,
  durationMs,
  timestamp,
  buildUrl,
  nowMs,
}: {
  serviceLabel: string;
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
  const chipClassName = `env-chip ${envChipClassName(environment)} ${deploymentChipClassName(status)}`;
  const titleParts = [
    `${serviceLabel} · ${environment}`,
    `Build #${buildNumber}`,
  ];
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

  return (
    <div className="deployment-active-row">
      <span className="deployment-active-service">{serviceLabel}</span>
      {buildUrl ? (
        <a
          className={`${chipClassName} deployment-active-chip`}
          href={buildUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
        >
          {chipContent}
        </a>
      ) : (
        <span className={`${chipClassName} deployment-active-chip`} title={title}>
          {chipContent}
        </span>
      )}
    </div>
  );
}

export function ActiveDeploymentsPanel({ todos }: ActiveDeploymentsPanelProps) {
  const rows = useMemo(() => collectTodayServiceDeployments(todos), [todos]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!rows.some((row) => row.status === DeploymentStatus.IN_PROGRESS)) return;

    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [rows]);

  return (
    <div className="deployments-panel">
      <h2 className="deployments-panel-title">Today&apos;s Deployments</h2>

      {rows.length === 0 ? (
        <div className="deployments-panel-empty">
          <p>No deployments today</p>
        </div>
      ) : (
        <div className="deployments-active-list">
          {rows.map((row) => (
            <DeploymentRow
              key={row.id}
              serviceLabel={row.serviceLabel}
              environment={row.environment}
              status={row.status}
              buildNumber={row.buildNumber}
              durationMs={row.durationMs}
              timestamp={row.timestamp}
              buildUrl={row.buildUrl}
              nowMs={nowMs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
