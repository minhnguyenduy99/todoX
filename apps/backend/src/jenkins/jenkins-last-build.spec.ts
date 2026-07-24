import { fetchJenkinsJobLastBuild } from './jenkins-last-build';

describe('fetchJenkinsJobLastBuild', () => {
  const auth = 'dXNlcjpwYXNz';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns mapped lastBuild when Jenkins responds with 200', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        lastBuild: {
          number: 42,
          result: 'SUCCESS',
          building: false,
          duration: 1000,
          timestamp: 1_700_000_000_000,
          url: 'https://jenkins.example.net/job/auth-staging/42/',
        },
      }),
    } as Response);

    const result = await fetchJenkinsJobLastBuild(
      'https://jenkins.example.net/job/auth-staging',
      auth,
    );

    expect(result).toEqual({
      number: 42,
      result: 'SUCCESS',
      building: false,
      duration: 1000,
      timestamp: 1_700_000_000_000,
      url: 'https://jenkins.example.net/job/auth-staging/42/',
    });
  });

  it('returns null when job has no lastBuild', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ lastBuild: null }),
    } as Response);

    const result = await fetchJenkinsJobLastBuild(
      'https://jenkins.example.net/job/auth-staging',
      auth,
    );

    expect(result).toBeNull();
  });

  it('throws when Jenkins returns non-2xx', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(
      fetchJenkinsJobLastBuild('https://jenkins.example.net/job/missing', auth),
    ).rejects.toThrow('Jenkins API returned 404');
  });
});
