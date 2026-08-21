import {
  DeploymentStatus,
  ReleaseDeploymentStatus,
  type MonitorDto,
  type ReleaseDeploymentDto,
} from '@todo-platform/shared-types';

export function formatDeploymentDuration(durationMs: number | null): string | null {
  if (durationMs === null || durationMs <= 0) return null;
  if (durationMs < 60_000) return `${Math.round(durationMs / 1000)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatDeploymentCurrentStep(
  status: DeploymentStatus,
  currentStep?: string | null,
): string | null {
  if (status !== DeploymentStatus.IN_PROGRESS) return null;
  const trimmed = currentStep?.trim();
  return trimmed ? trimmed : null;
}

export function resolveDeploymentDurationMs(
  durationMs: number | null,
  status: DeploymentStatus,
  timestamp?: number,
  nowMs: number = Date.now(),
): number | null {
  if (durationMs !== null && durationMs > 0) return durationMs;
  if (
    status === DeploymentStatus.IN_PROGRESS &&
    typeof timestamp === 'number' &&
    timestamp > 0
  ) {
    return Math.max(0, nowMs - timestamp);
  }
  return null;
}

/** Chip colors driven by deployment poll status (not environment). */
export function deploymentStatusChipClassName(
  status: DeploymentStatus | undefined,
): string {
  switch (status) {
    case DeploymentStatus.IN_PROGRESS:
      return 'env-chip-status-in-progress';
    case DeploymentStatus.SUCCESS:
      return 'env-chip-status-success';
    case DeploymentStatus.FAIL:
      return 'env-chip-status-fail';
    default:
      return 'env-chip-status-neutral';
  }
}

/** Chip class for todo env chips: status when polled, green when env-only. */
export function todoDeployedEnvironmentChipClassName(
  deployment: { status: DeploymentStatus } | undefined,
): string {
  if (deployment) {
    return deploymentStatusChipClassName(deployment.status);
  }
  return 'env-chip-status-success';
}

/** Chip colors for release-level deployment rows. */
export function releaseDeploymentStatusChipClassName(
  status: ReleaseDeploymentStatus,
): string {
  switch (status) {
    case ReleaseDeploymentStatus.IN_PROGRESS:
      return 'env-chip-status-in-progress';
    case ReleaseDeploymentStatus.SUCCESSFUL:
      return 'env-chip-status-success';
    case ReleaseDeploymentStatus.FAILED:
      return 'env-chip-status-fail';
    default:
      return 'env-chip-status-neutral';
  }
}

export function resolveJenkinsBuildUrl(
  jobUrl: string | null | undefined,
  buildNumber: number | null | undefined,
  buildUrl?: string | null,
): string | undefined {
  if (buildUrl) return buildUrl;
  if (!jobUrl || buildNumber == null) return undefined;
  const base = jobUrl.replace(/\/+$/, '');
  return `${base}/${buildNumber}/`;
}

/** Convert a classic Jenkins build URL to a Blue Ocean pipeline detail URL. */
export function resolveBlueOceanPipelineUrl(buildUrl?: string | null): string | undefined {
  if (!buildUrl) return undefined;

  const trimmed = buildUrl.trim().replace(/\/+$/, '');
  if (trimmed.includes('/blue/organizations/')) {
    return trimmed.endsWith('/pipeline') ? trimmed : `${trimmed}/pipeline`;
  }

  try {
    const url = new URL(trimmed);
    const pathWithoutTrailing = url.pathname.replace(/\/+$/, '');
    const buildMatch = pathWithoutTrailing.match(/^(.*)\/(\d+)$/);
    if (!buildMatch) return undefined;

    const jobPathname = buildMatch[1];
    const buildNumber = buildMatch[2];
    const segments = [...jobPathname.matchAll(/\/job\/([^/]+)/g)].map((match) => match[1]);
    if (segments.length === 0) return undefined;

    const jobName = segments[segments.length - 1];
    const folderPath = segments.join('/');
    return `${url.origin}/blue/organizations/jenkins/${folderPath}/detail/${jobName}/${buildNumber}/pipeline`;
  } catch {
    return undefined;
  }
}

export function extractMonitorDeploymentBuildUrl(
  monitor: MonitorDto | null | undefined,
): string | undefined {
  const metadata = monitor?.lastResult?.metadata as
    | { deployment?: { buildUrl?: string } }
    | undefined;
  return metadata?.deployment?.buildUrl;
}

export function resolveReleaseDeploymentBuildUrl(
  deployment: ReleaseDeploymentDto,
): string | undefined {
  return (
    extractMonitorDeploymentBuildUrl(deployment.monitor) ??
    resolveJenkinsBuildUrl(deployment.jobUrl, deployment.buildNumber)
  );
}
