import type { DeploymentMonitorConfig } from '@todo-platform/shared-types';

export interface ParsedJenkinsJobUrl {
  jobUrl: string;
  buildNumber: number;
}

export function parseJenkinsJobUrl(input: string): ParsedJenkinsJobUrl {
  const trimmed = input.trim().replace(/\/+$/, '');
  const match = trimmed.match(/^(.*)\/(\d+)$/);
  if (!match) {
    throw new Error(
      'Invalid Jenkins job URL: expected a build URL ending with /buildNumber',
    );
  }

  const buildNumber = Number.parseInt(match[2], 10);
  if (!Number.isFinite(buildNumber) || buildNumber < 1) {
    throw new Error('Invalid Jenkins build number in URL');
  }

  return {
    jobUrl: match[1],
    buildNumber,
  };
}

/** Accept job URL + buildNumber or a full build URL (with optional duplicate buildNumber). */
export function normalizeDeploymentMonitorConfig(
  config: DeploymentMonitorConfig,
): DeploymentMonitorConfig {
  const trimmedUrl = config.jobUrl.trim().replace(/\/+$/, '');
  const match = trimmedUrl.match(/^(.*)\/(\d+)$/);
  if (!match) {
    return { ...config, jobUrl: trimmedUrl };
  }

  const urlBuildNumber = Number.parseInt(match[2], 10);
  if (!Number.isFinite(urlBuildNumber) || urlBuildNumber < 1) {
    return { ...config, jobUrl: trimmedUrl };
  }

  return {
    ...config,
    jobUrl: match[1],
    buildNumber: config.buildNumber ?? urlBuildNumber,
  };
}
