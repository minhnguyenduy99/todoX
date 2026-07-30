import type { ReactNode } from 'react';
import {
  DEPLOYED_ENVIRONMENT_ORDER,
  DeploymentStatus,
  type DeployedEnvironmentDto,
} from '@todo-platform/shared-types';
import { sortDeploymentsForDisplay } from '../utils/deploymentSort';
import {
  todoDeployedEnvironmentChipClassName,
  formatDeploymentCurrentStep,
  formatDeploymentDuration,
  resolveDeploymentDurationMs,
} from '../utils/deploymentDisplay';

interface DeployedEnvironmentListProps {
  deployedEnvironments: DeployedEnvironmentDto[];
  compact?: boolean;
  layout?: 'chips' | 'lines';
}

function resolveChipClassName(deployment: DeployedEnvironmentDto['deployment']): string {
  return todoDeployedEnvironmentChipClassName(deployment);
}

function formatDuration(
  deployment: DeployedEnvironmentDto['deployment'],
): string | null {
  if (!deployment) return null;
  return formatDeploymentDuration(
    resolveDeploymentDurationMs(
      deployment.durationMs,
      deployment.status,
      deployment.timestamp,
    ),
  );
}

function buildChipTitle(env: DeployedEnvironmentDto): string {
  const deployment = env.deployment;
  if (!deployment) return `Deployed to ${env.name}`;

  const parts = [
    `Deployed to ${env.name}`,
    `Job: ${deployment.jobName}`,
    `Build #${deployment.buildNumber}`,
    `Status: ${deployment.status}`,
  ];
  const currentStep = formatDeploymentCurrentStep(deployment.status, deployment.currentStep);
  if (currentStep) parts.push(`Stage: ${currentStep}`);
  const duration = formatDuration(deployment);
  if (duration) parts.push(`Duration: ${duration}`);
  if (deployment.buildUrl) parts.push(deployment.buildUrl);
  return parts.join(' · ');
}

function sortEnvironmentsByName(
  environments: DeployedEnvironmentDto[],
): DeployedEnvironmentDto[] {
  return [...environments].sort(
    (a, b) =>
      DEPLOYED_ENVIRONMENT_ORDER.indexOf(a.name) -
      DEPLOYED_ENVIRONMENT_ORDER.indexOf(b.name),
  );
}

function EnvChipContent({
  env,
  deployment,
  duration,
}: {
  env: DeployedEnvironmentDto;
  deployment: DeployedEnvironmentDto['deployment'];
  duration: string | null;
}) {
  const currentStep = deployment
    ? formatDeploymentCurrentStep(deployment.status, deployment.currentStep)
    : null;

  return (
    <>
      <span className="env-chip-row">
        <span
          className={`env-chip-label${deployment?.status === DeploymentStatus.IN_PROGRESS ? ' env-chip-label-marquee' : ''}`}
        >
          {env.name}
        </span>
        {deployment && (
          <span className="env-chip-meta">
            {deployment.status === DeploymentStatus.IN_PROGRESS && (
              <span className="env-chip-spinner" aria-hidden="true" />
            )}
            <span className="env-chip-build">#{deployment.buildNumber}</span>
            {duration && <span className="env-chip-duration">{duration}</span>}
          </span>
        )}
      </span>
      {currentStep && (
        <span className="env-chip-step" title={currentStep}>
          {currentStep}
        </span>
      )}
    </>
  );
}

function chipHasCurrentStep(
  deployment: DeployedEnvironmentDto['deployment'],
): boolean {
  return Boolean(
    deployment &&
      formatDeploymentCurrentStep(deployment.status, deployment.currentStep),
  );
}

function EnvChip({
  env,
  className,
  title,
  children,
}: {
  env: DeployedEnvironmentDto;
  className: string;
  title: string;
  children: ReactNode;
}) {
  const buildUrl = env.deployment?.buildUrl;

  if (buildUrl) {
    return (
      <a
        className={className}
        href={buildUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </a>
    );
  }

  return (
    <span className={className} title={title}>
      {children}
    </span>
  );
}

export function DeployedEnvironmentList({
  deployedEnvironments,
  compact = false,
  layout = 'chips',
}: DeployedEnvironmentListProps) {
  if (deployedEnvironments.length === 0) return null;

  const sorted =
    layout === 'lines'
      ? sortDeploymentsForDisplay(deployedEnvironments)
      : sortEnvironmentsByName(deployedEnvironments);

  if (layout === 'lines') {
    return (
      <div className="deployment-lines" title="Deployments">
        {sorted.map((env) => {
          const deployment = env.deployment;
          const duration = formatDuration(deployment);
          const rowClassName = `deployment-line env-chip ${resolveChipClassName(deployment)}${
            chipHasCurrentStep(deployment) ? ' env-chip-has-step' : ''
          }`;

          return (
            <EnvChip
              key={env.id}
              env={env}
              className={rowClassName}
              title={buildChipTitle(env)}
            >
              <EnvChipContent env={env} deployment={deployment} duration={duration} />
            </EnvChip>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`env-list${compact ? ' env-list-compact' : ''}`}
      title="Deployed environments"
    >
      {sorted.map((env) => {
        const deployment = env.deployment;
        const duration = formatDuration(deployment);
        const chipClassName = `env-chip ${resolveChipClassName(deployment)}${
          chipHasCurrentStep(deployment) ? ' env-chip-has-step' : ''
        }`;

        return (
          <EnvChip
            key={env.id}
            env={env}
            className={chipClassName}
            title={buildChipTitle(env)}
          >
            <EnvChipContent env={env} deployment={deployment} duration={duration} />
          </EnvChip>
        );
      })}
    </div>
  );
}
