import {
  MonitorResultStatus,
  MonitorType,
  type HttpMonitorConfig,
  type MonitorProvider,
  type MonitorResult,
  type GitHubPrMonitorConfig,
  type DeploymentMonitorConfig,
} from '@todo-platform/shared-types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.validation';

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

@Injectable()
export class DeploymentMonitorProvider implements MonitorProvider {
  readonly type = MonitorType.DEPLOYMENT;

  async check(config: unknown): Promise<MonitorResult> {
    const cfg = config as DeploymentMonitorConfig;
    if (!cfg?.url) {
      return { status: MonitorResultStatus.FAILED, message: 'Missing url in config' };
    }

    const method = cfg.method ?? 'GET';
    const expectedStatus = cfg.expectedStatus ?? 200;

    try {
      const response = await fetch(cfg.url, {
        method,
        signal: AbortSignal.timeout(15000),
      });

      if (response.status !== expectedStatus) {
        return {
          status: MonitorResultStatus.RUNNING,
          message: `Deployment endpoint returned ${response.status}, still monitoring`,
          metadata: { statusCode: response.status, deploymentId: cfg.deploymentId },
        };
      }

      let body: Record<string, unknown> | undefined;
      try {
        body = (await response.json()) as Record<string, unknown>;
      } catch {
        body = undefined;
      }

      const deploymentStatus = body?.status ?? body?.state;
      if (
        deploymentStatus === 'success' ||
        deploymentStatus === 'completed' ||
        deploymentStatus === 'ready'
      ) {
        return {
          status: MonitorResultStatus.SUCCESS,
          message: 'Deployment completed successfully',
          metadata: { deploymentId: cfg.deploymentId, body },
        };
      }

      if (deploymentStatus === 'failed' || deploymentStatus === 'error') {
        return {
          status: MonitorResultStatus.FAILED,
          message: 'Deployment failed',
          metadata: { deploymentId: cfg.deploymentId, body },
        };
      }

      return {
        status: MonitorResultStatus.RUNNING,
        message: 'Deployment is still in progress',
        metadata: { deploymentId: cfg.deploymentId, body },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: MonitorResultStatus.FAILED,
        message: `Deployment check failed: ${message}`,
      };
    }
  }
}
