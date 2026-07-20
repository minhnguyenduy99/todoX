import {
  DeployedEnvironmentName,
  MonitorType,
  type DeploymentInfo,
  type DeploymentMonitorConfig,
  type DeployedEnvironmentDto,
  type MonitorDto,
  type MonitorResult,
} from '@todo-platform/shared-types';
import type { DeployedEnvironment } from '@prisma/client';

export function extractDeploymentInfo(
  lastResult: MonitorResult | null | undefined,
): DeploymentInfo | undefined {
  if (!lastResult?.metadata) return undefined;
  const deployment = lastResult.metadata.deployment;
  if (!deployment || typeof deployment !== 'object') return undefined;
  const info = deployment as DeploymentInfo;
  if (
    typeof info.env !== 'string' ||
    typeof info.jobName !== 'string' ||
    typeof info.buildNumber !== 'number' ||
    typeof info.status !== 'string'
  ) {
    return undefined;
  }
  return info;
}

function isDeploymentMonitor(monitor: MonitorDto): boolean {
  return monitor.type === MonitorType.DEPLOYMENT && monitor.enabled;
}

function deploymentFromMonitor(
  monitor: MonitorDto,
): { env: DeployedEnvironmentName; deployment: DeploymentInfo } | undefined {
  if (!isDeploymentMonitor(monitor)) return undefined;

  const cfg = monitor.config as unknown as DeploymentMonitorConfig;
  if (!cfg?.env) return undefined;

  const deployment = extractDeploymentInfo(monitor.lastResult);
  if (!deployment) return undefined;

  return { env: cfg.env, deployment };
}

function pickLatestDeployment(
  current: { deployment: DeploymentInfo; lastRunAt: string | null } | undefined,
  candidate: DeploymentInfo,
  candidateLastRunAt: string | null,
): { deployment: DeploymentInfo; lastRunAt: string | null } {
  if (!current) {
    return { deployment: candidate, lastRunAt: candidateLastRunAt };
  }
  if (!candidateLastRunAt) return current;
  if (!current.lastRunAt) {
    return { deployment: candidate, lastRunAt: candidateLastRunAt };
  }
  return candidateLastRunAt >= current.lastRunAt
    ? { deployment: candidate, lastRunAt: candidateLastRunAt }
    : current;
}

export function enrichDeployedEnvironments(
  environments: DeployedEnvironment[],
  monitors: MonitorDto[],
  toBaseDto: (env: DeployedEnvironment) => Omit<DeployedEnvironmentDto, 'deployment'>,
): DeployedEnvironmentDto[] {
  const deploymentByEnv = new Map<
    DeployedEnvironmentName,
    { deployment: DeploymentInfo; lastRunAt: string | null }
  >();

  for (const monitor of monitors) {
    const match = deploymentFromMonitor(monitor);
    if (!match) continue;

    const { env: envName, deployment } = match;
    const existing = deploymentByEnv.get(envName);
    deploymentByEnv.set(
      envName,
      pickLatestDeployment(existing, deployment, monitor.lastRunAt),
    );
  }

  return environments.map((env) => {
    const base = toBaseDto(env);
    const match = deploymentByEnv.get(base.name);
    return match ? { ...base, deployment: match.deployment } : base;
  });
}

export function collectDeploymentMonitors(
  subtaskMonitors: Array<MonitorDto | null | undefined>,
): MonitorDto[] {
  return subtaskMonitors.filter((monitor): monitor is MonitorDto => monitor != null);
}
