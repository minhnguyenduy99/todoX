import { DeployedEnvironmentName } from '@todo-platform/shared-types';
import { parseJenkinsJobUrl, normalizeDeploymentMonitorConfig } from './parse-jenkins-job-url';

describe('parseJenkinsJobUrl', () => {
  it('parses a full Jenkins build URL', () => {
    expect(
      parseJenkinsJobUrl('https://jenkins-scan.example.net/job/test-scan/42'),
    ).toEqual({
      jobUrl: 'https://jenkins-scan.example.net/job/test-scan',
      buildNumber: 42,
    });
  });

  it('parses a build URL with trailing slash', () => {
    expect(
      parseJenkinsJobUrl('https://jenkins-scan.example.net/job/test-scan/42/'),
    ).toEqual({
      jobUrl: 'https://jenkins-scan.example.net/job/test-scan',
      buildNumber: 42,
    });
  });

  it('throws for job URL without build number', () => {
    expect(() =>
      parseJenkinsJobUrl('https://jenkins-scan.example.net/job/test-scan'),
    ).toThrow(/buildNumber/);
  });
});

describe('normalizeDeploymentMonitorConfig', () => {
  it('leaves job URL + buildNumber unchanged', () => {
    expect(
      normalizeDeploymentMonitorConfig({
        env: DeployedEnvironmentName.DEV,
        jobUrl: 'https://jenkins2.flodev.net/job/backend-nodejs-4-1.backend.dev.deploy/',
        buildNumber: 2805,
      }),
    ).toEqual({
      env: 'dev',
      jobUrl: 'https://jenkins2.flodev.net/job/backend-nodejs-4-1.backend.dev.deploy',
      buildNumber: 2805,
    });
  });

  it('strips build number from a full build URL when buildNumber is also set', () => {
    expect(
      normalizeDeploymentMonitorConfig({
        env: DeployedEnvironmentName.DEV,
        jobUrl:
          'https://jenkins2.flodev.net/job/backend-nodejs-4-1.backend.dev.deploy/2805/',
        buildNumber: 2805,
      }),
    ).toEqual({
      env: 'dev',
      jobUrl: 'https://jenkins2.flodev.net/job/backend-nodejs-4-1.backend.dev.deploy',
      buildNumber: 2805,
    });
  });

  it('prefers explicit buildNumber when job URL also ends with a build segment', () => {
    expect(
      normalizeDeploymentMonitorConfig({
        env: DeployedEnvironmentName.DEV,
        jobUrl: 'https://jenkins.example.net/job/my-job/100/',
        buildNumber: 200,
      }),
    ).toEqual({
      env: 'dev',
      jobUrl: 'https://jenkins.example.net/job/my-job',
      buildNumber: 200,
    });
  });
});
