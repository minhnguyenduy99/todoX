import { parseJenkinsJobUrl } from './parse-jenkins-job-url';

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
