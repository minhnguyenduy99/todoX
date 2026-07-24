import type { EnvConfig } from '../config/env.validation';
import { normalizeJenkinsJobUrl } from '../common/normalize-jenkins-job-url';

export interface JenkinsLastBuild {
  number: number;
  result: string | null;
  building: boolean;
  duration: number;
  timestamp: number;
  url: string;
}

interface JenkinsJobResponse {
  lastBuild?: {
    number?: number;
    result?: string | null;
    building?: boolean;
    duration?: number;
    timestamp?: number;
    url?: string;
  } | null;
}

export async function fetchJenkinsJobLastBuild(
  jobUrl: string,
  auth: EnvConfig['JENKINS_AUTH'],
): Promise<JenkinsLastBuild | null> {
  const normalizedJobUrl = normalizeJenkinsJobUrl(jobUrl);
  if (!normalizedJobUrl) {
    throw new Error('jobUrl is required');
  }
  if (!auth) {
    throw new Error('JENKINS_AUTH is not configured');
  }

  const apiUrl = `${normalizedJobUrl}/api/json?tree=lastBuild[number,result,building,duration,timestamp,url]`;
  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Jenkins API returned ${response.status}`);
  }

  const job = (await response.json()) as JenkinsJobResponse;
  const lastBuild = job.lastBuild;
  if (!lastBuild?.number || !lastBuild.url || lastBuild.timestamp === undefined) {
    return null;
  }

  return {
    number: lastBuild.number,
    result: lastBuild.result ?? null,
    building: lastBuild.building ?? false,
    duration: lastBuild.duration ?? 0,
    timestamp: lastBuild.timestamp,
    url: lastBuild.url,
  };
}
