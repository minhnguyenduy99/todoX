import {
  DeploymentStatus,
  MonitorResultStatus,
  MonitorType,
  type DeploymentInfo,
  type DeploymentMonitorConfig,
  type DeploymentDiscoveryMonitorConfig,
  type HttpMonitorConfig,
  type MonitorProvider,
  type MonitorResult,
  type GitHubPrMonitorConfig,
  type ScanJobInfo,
  type TestcaseScanMonitorConfig,
} from '@todo-platform/shared-types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.validation';
import { normalizeDeploymentMonitorConfig } from '../../common/parse-jenkins-job-url';
import { fetchJenkinsJobLastBuild } from '../../jenkins/jenkins-last-build';
import { parseJenkinsJobUrl } from '../../common/parse-jenkins-job-url';

@Injectable()
export class HttpMonitorProvider implements MonitorProvider {
  readonly type = MonitorType.HTTP;

  async check(config: unknown): Promise<MonitorResult> {
    const cfg = config as HttpMonitorConfig;
    if (!cfg?.url) {
      return { status: MonitorResultStatus.FAILED, message: 'Missing url in config' };
    }

    const method = cfg.method ?? 'GET';
    const expectedStatus = cfg.expectedStatus ?? 200;

    try {
      const response = await fetch(cfg.url, {
        method,
        headers: cfg.headers,
        body: cfg.body,
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === expectedStatus) {
        return {
          status: MonitorResultStatus.SUCCESS,
          message: `HTTP ${method} ${cfg.url} returned ${response.status}`,
          metadata: { statusCode: response.status },
        };
      }

      return {
        status: MonitorResultStatus.FAILED,
        message: `Expected status ${expectedStatus}, got ${response.status}`,
        metadata: { statusCode: response.status },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: MonitorResultStatus.FAILED,
        message: `HTTP request failed: ${message}`,
      };
    }
  }
}

@Injectable()
export class GitHubPrMonitorProvider implements MonitorProvider {
  readonly type = MonitorType.GITHUB_PR;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async check(config: unknown): Promise<MonitorResult> {
    const cfg = config as GitHubPrMonitorConfig;
    if (!cfg?.owner || !cfg?.repo || !cfg?.pullNumber) {
      return {
        status: MonitorResultStatus.FAILED,
        message: 'Missing owner, repo, or pullNumber in config',
      };
    }

    const token = this.configService.get('GITHUB_TOKEN', { infer: true });
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'todo-platform-monitor',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/pulls/${cfg.pullNumber}`;

    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return {
          status: MonitorResultStatus.FAILED,
          message: `GitHub API returned ${response.status}`,
          metadata: { statusCode: response.status },
        };
      }

      const pr = (await response.json()) as { merged: boolean; state: string };
      if (pr.merged) {
        return {
          status: MonitorResultStatus.SUCCESS,
          message: `PR #${cfg.pullNumber} has been merged`,
          metadata: { merged: true, state: pr.state },
        };
      }

      return {
        status: MonitorResultStatus.RUNNING,
        message: `PR #${cfg.pullNumber} is not merged yet (state: ${pr.state})`,
        metadata: { merged: false, state: pr.state },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: MonitorResultStatus.FAILED,
        message: `GitHub PR check failed: ${message}`,
      };
    }
  }
}

interface JenkinsBuildResponse {
  building: boolean;
  result: string | null;
  duration: number;
  timestamp: number;
  url: string;
}

export function resolveJenkinsBuildDurationMs(build: JenkinsBuildResponse): number | null {
  if (build.duration > 0) return build.duration;
  if (build.building && build.timestamp > 0) {
    return Math.max(0, Date.now() - build.timestamp);
  }
  return null;
}

export function parseJobNameFromUrl(jobUrl: string): string {
  const trimmed = jobUrl.replace(/\/+$/, '');
  const segments = trimmed.split('/');
  return segments[segments.length - 1] ?? trimmed;
}

export function mapJenkinsBuildToDeployment(
  cfg: DeploymentMonitorConfig,
  build: JenkinsBuildResponse,
): { deployment: DeploymentInfo; monitorStatus: MonitorResultStatus } {
  let deploymentStatus: DeploymentStatus;
  let monitorStatus: MonitorResultStatus;

  if (build.building) {
    deploymentStatus = DeploymentStatus.IN_PROGRESS;
    monitorStatus = MonitorResultStatus.RUNNING;
  } else if (build.result === 'SUCCESS') {
    deploymentStatus = DeploymentStatus.SUCCESS;
    monitorStatus = MonitorResultStatus.SUCCESS;
  } else if (
    build.result === 'FAILURE' ||
    build.result === 'ABORTED' ||
    build.result === 'UNSTABLE'
  ) {
    deploymentStatus = DeploymentStatus.FAIL;
    monitorStatus = MonitorResultStatus.FAILED;
  } else {
    deploymentStatus = DeploymentStatus.IN_PROGRESS;
    monitorStatus = MonitorResultStatus.RUNNING;
  }

  const deployment: DeploymentInfo = {
    env: cfg.env,
    jobName: parseJobNameFromUrl(cfg.jobUrl),
    buildNumber: cfg.buildNumber,
    durationMs: resolveJenkinsBuildDurationMs(build),
    status: deploymentStatus,
    buildUrl: build.url,
    timestamp: build.timestamp,
  };

  return { deployment, monitorStatus };
}

export function mapJenkinsBuildToScan(
  cfg: TestcaseScanMonitorConfig,
  build: JenkinsBuildResponse,
): { scan: ScanJobInfo; monitorStatus: MonitorResultStatus } {
  let scanStatus: DeploymentStatus;
  let monitorStatus: MonitorResultStatus;

  if (build.building) {
    scanStatus = DeploymentStatus.IN_PROGRESS;
    monitorStatus = MonitorResultStatus.RUNNING;
  } else if (build.result === 'SUCCESS' || build.result === 'UNSTABLE') {
    scanStatus = DeploymentStatus.SUCCESS;
    monitorStatus = MonitorResultStatus.SUCCESS;
  } else if (build.result === 'FAILURE' || build.result === 'ABORTED') {
    scanStatus = DeploymentStatus.FAIL;
    monitorStatus = MonitorResultStatus.FAILED;
  } else {
    scanStatus = DeploymentStatus.IN_PROGRESS;
    monitorStatus = MonitorResultStatus.RUNNING;
  }

  const scan: ScanJobInfo = {
    jobName: parseJobNameFromUrl(cfg.jobUrl),
    buildNumber: cfg.buildNumber,
    durationMs: resolveJenkinsBuildDurationMs(build),
    status: scanStatus,
    buildUrl: build.url,
    timestamp: build.timestamp,
    result: build.building
      ? null
      : (build.result as ScanJobInfo['result']) ?? null,
  };

  return { scan, monitorStatus };
}

@Injectable()
export class DeploymentMonitorProvider implements MonitorProvider {
  readonly type = MonitorType.DEPLOYMENT;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async check(config: unknown): Promise<MonitorResult> {
    const raw = config as DeploymentMonitorConfig;
    if (!raw?.env || !raw?.jobUrl || raw.buildNumber === undefined || raw.buildNumber === null) {
      return {
        status: MonitorResultStatus.FAILED,
        message: 'Missing env, jobUrl, or buildNumber in config',
      };
    }

    const cfg = normalizeDeploymentMonitorConfig(raw);

    const auth = this.configService.get('JENKINS_AUTH', { infer: true });
    if (!auth) {
      return {
        status: MonitorResultStatus.FAILED,
        message: 'JENKINS_AUTH is not configured',
      };
    }

    const jobUrl = cfg.jobUrl.replace(/\/+$/, '');
    const apiUrl = `${jobUrl}/${cfg.buildNumber}/api/json?tree=building,result,duration,timestamp,url`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return {
          status: MonitorResultStatus.FAILED,
          message: `Jenkins API returned ${response.status}`,
          metadata: { statusCode: response.status },
        };
      }

      const build = (await response.json()) as JenkinsBuildResponse;
      const { deployment, monitorStatus } = mapJenkinsBuildToDeployment(cfg, build);

      const statusLabel =
        deployment.status === DeploymentStatus.IN_PROGRESS
          ? 'in progress'
          : deployment.status === DeploymentStatus.SUCCESS
            ? 'succeeded'
            : 'failed';

      return {
        status: monitorStatus,
        message: `Deployment to ${cfg.env} build #${cfg.buildNumber} ${statusLabel}`,
        metadata: { deployment },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: MonitorResultStatus.FAILED,
        message: `Jenkins deployment check failed: ${message}`,
      };
    }
  }
}

@Injectable()
export class TestcaseScanMonitorProvider implements MonitorProvider {
  readonly type = MonitorType.TESTCASE_SCAN;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async check(config: unknown): Promise<MonitorResult> {
    const cfg = config as TestcaseScanMonitorConfig;
    if (!cfg?.jobUrl || cfg.buildNumber === undefined || cfg.buildNumber === null) {
      return {
        status: MonitorResultStatus.FAILED,
        message: 'Missing jobUrl or buildNumber in config',
      };
    }

    const auth = this.configService.get('JENKINS_SCAN_AUTH', { infer: true });
    if (!auth) {
      return {
        status: MonitorResultStatus.FAILED,
        message: 'JENKINS_SCAN_AUTH is not configured',
      };
    }

    const jobUrl = cfg.jobUrl.replace(/\/+$/, '');
    const apiUrl = `${jobUrl}/${cfg.buildNumber}/api/json?tree=building,result,duration,timestamp,url`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return {
          status: MonitorResultStatus.FAILED,
          message: `Jenkins API returned ${response.status}`,
          metadata: { statusCode: response.status },
        };
      }

      const build = (await response.json()) as JenkinsBuildResponse;
      const { scan, monitorStatus } = mapJenkinsBuildToScan(cfg, build);

      const statusLabel =
        scan.status === DeploymentStatus.IN_PROGRESS
          ? 'in progress'
          : scan.status === DeploymentStatus.SUCCESS
            ? 'completed'
            : 'failed';

      return {
        status: monitorStatus,
        message: `Testcase scan build #${cfg.buildNumber} ${statusLabel}`,
        metadata: { scan },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: MonitorResultStatus.FAILED,
        message: `Jenkins testcase scan check failed: ${message}`,
      };
    }
  }
}

@Injectable()
export class DeploymentDiscoveryMonitorProvider implements MonitorProvider {
  readonly type = MonitorType.DEPLOYMENT_DISCOVERY;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async check(config: unknown): Promise<MonitorResult> {
    const cfg = config as DeploymentDiscoveryMonitorConfig;
    if (!cfg?.releaseId || !cfg.releaseCreatedAtMs || !cfg.pendingServices?.length) {
      return {
        status: MonitorResultStatus.RUNNING,
        message: 'No pending services to discover',
        metadata: { discovered: [], errors: [] },
      };
    }

    const auth = this.configService.get('JENKINS_AUTH', { infer: true });
    if (!auth) {
      return {
        status: MonitorResultStatus.FAILED,
        message: 'JENKINS_AUTH is not configured',
      };
    }

    const discovered: Array<{ serviceId: string; jobUrl: string; buildNumber: number }> = [];
    const errors: Array<{ serviceId: string; message: string }> = [];

    for (const pending of cfg.pendingServices) {
      try {
        const lastBuild = await fetchJenkinsJobLastBuild(pending.catalogJobUrl, auth);
        if (!lastBuild || lastBuild.timestamp <= cfg.releaseCreatedAtMs) {
          continue;
        }

        const parsed = parseJenkinsJobUrl(lastBuild.url);
        discovered.push({
          serviceId: pending.serviceId,
          jobUrl: parsed.jobUrl,
          buildNumber: parsed.buildNumber,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ serviceId: pending.serviceId, message });
      }
    }

    return {
      status: MonitorResultStatus.RUNNING,
      message:
        discovered.length > 0
          ? `Discovered ${discovered.length} staging deployment(s)`
          : `Watching ${cfg.pendingServices.length} service(s) for staging deployments`,
      metadata: {
        discovered,
        errors,
        skippedServices: cfg.skippedServices ?? [],
      },
    };
  }
}
