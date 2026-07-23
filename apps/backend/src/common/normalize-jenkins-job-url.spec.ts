import { normalizeJenkinsJobUrl } from './normalize-jenkins-job-url';

describe('normalizeJenkinsJobUrl', () => {
  it('returns trimmed job URL unchanged when no build suffix', () => {
    expect(
      normalizeJenkinsJobUrl('https://jenkins.example.net/job/my-job/'),
    ).toBe('https://jenkins.example.net/job/my-job');
  });

  it('strips trailing build number from pasted build URL', () => {
    expect(
      normalizeJenkinsJobUrl('https://jenkins.example.net/job/my-job/42'),
    ).toBe('https://jenkins.example.net/job/my-job');
  });

  it('keeps URL when trailing segment is not a valid build number', () => {
    expect(normalizeJenkinsJobUrl('https://jenkins.example.net/job/my-job/v2')).toBe(
      'https://jenkins.example.net/job/my-job/v2',
    );
  });
});
