import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeploymentStatus,
  type ServiceDeploymentValidationPreviewDto,
} from '@todo-platform/shared-types';
import type { EnvConfig } from '../config/env.validation';
import { normalizeJenkinsJobUrl } from '../common/normalize-jenkins-job-url';
import { parseJobNameFromUrl } from '../monitors/providers/monitor-providers';

interface JenkinsLastBuildResponse {
  number?: number;
  result?: string | null;
  building?: boolean;
  duration?: number;
  timestamp?: number;
  url?: string;
}

interface JenkinsJobResponse {
  name?: string;
  url?: string;
  lastBuild?: JenkinsLastBuildResponse | null;
}

export interface JenkinsJobValidationResult {
  valid: boolean;
  preview?: ServiceDeploymentValidationPreviewDto;
  error?: string;
}

@Injectable()
export class JenkinsJobValidationService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async validateJobUrl(jobUrl: string): Promise<JenkinsJobValidationResult> {
    const normalizedJobUrl = normalizeJenkinsJobUrl(jobUrl);
    if (!normalizedJobUrl) {
      return { valid: false, error: 'jobUrl is required' };
    }

    const auth = this.configService.get('JENKINS_AUTH', { infer: true });
    if (!auth) {
      return { valid: false, error: 'JENKINS_AUTH is not configured' };
    }

    const apiUrl = `${normalizedJobUrl}/api/json?tree=name,url,lastBuild[number,result,building,duration,timestamp,url]`;

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
          valid: false,
          error: `Jenkins API returned ${response.status}`,
        };
      }

      const job = (await response.json()) as JenkinsJobResponse;
      const preview: ServiceDeploymentValidationPreviewDto = {
        jobName: job.name ?? parseJobNameFromUrl(normalizedJobUrl),
        normalizedJobUrl,
        lastBuild: mapLastBuildPreview(job.lastBuild),
      };

      return { valid: true, preview };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        error: `Jenkins job validation failed: ${message}`,
      };
    }
  }
}

function mapLastBuildPreview(
  lastBuild: JenkinsLastBuildResponse | null | undefined,
): ServiceDeploymentValidationPreviewDto['lastBuild'] {
  if (!lastBuild || lastBuild.number === undefined) {
    return null;
  }

  let status: DeploymentStatus;
  if (lastBuild.building) {
    status = DeploymentStatus.IN_PROGRESS;
  } else if (lastBuild.result === 'SUCCESS') {
    status = DeploymentStatus.SUCCESS;
  } else if (
    lastBuild.result === 'FAILURE' ||
    lastBuild.result === 'ABORTED' ||
    lastBuild.result === 'UNSTABLE'
  ) {
    status = DeploymentStatus.FAIL;
  } else {
    status = DeploymentStatus.IN_PROGRESS;
  }

  return {
    buildNumber: lastBuild.number,
    status,
    buildUrl: lastBuild.url,
    durationMs: lastBuild.duration && lastBuild.duration > 0 ? lastBuild.duration : null,
    timestamp: lastBuild.timestamp,
  };
}
