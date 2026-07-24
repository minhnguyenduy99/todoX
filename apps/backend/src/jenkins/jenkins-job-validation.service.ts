import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeploymentStatus,
  type ServiceDeploymentValidationPreviewDto,
} from '@todo-platform/shared-types';
import type { EnvConfig } from '../config/env.validation';
import { normalizeJenkinsJobUrl } from '../common/normalize-jenkins-job-url';
import { parseJobNameFromUrl } from '../monitors/providers/monitor-providers';
import { fetchJenkinsJobLastBuild } from './jenkins-last-build';

interface JenkinsLastBuildResponse {
  number?: number;
  result?: string | null;
  building?: boolean;
  duration?: number;
  timestamp?: number;
  url?: string;
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

    try {
      const lastBuild = await fetchJenkinsJobLastBuild(normalizedJobUrl, auth);
      const preview: ServiceDeploymentValidationPreviewDto = {
        jobName: parseJobNameFromUrl(normalizedJobUrl),
        normalizedJobUrl,
        lastBuild: lastBuild ? mapLastBuildPreview(lastBuild) : null,
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
  lastBuild: JenkinsLastBuildResponse,
): ServiceDeploymentValidationPreviewDto['lastBuild'] {
  if (lastBuild.number === undefined) {
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
