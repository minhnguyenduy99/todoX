import {
  fetchJenkinsPipelineStage,
  resolveCurrentPipelineStage,
} from './jenkins-pipeline-stage';

describe('resolveCurrentPipelineStage', () => {
  it('returns the first non-terminal stage name', () => {
    expect(
      resolveCurrentPipelineStage([
        { name: 'Build', status: 'SUCCESS' },
        { name: 'Deploy to UAT', status: 'IN_PROGRESS' },
        { name: 'Verify', status: 'NOT_EXECUTED' },
      ]),
    ).toBe('Deploy to UAT');
  });

  it('returns paused stage names', () => {
    expect(
      resolveCurrentPipelineStage([
        { name: 'Build', status: 'SUCCESS' },
        { name: 'Approve', status: 'PAUSED_PENDING_INPUT' },
      ]),
    ).toBe('Approve');
  });

  it('returns null when all stages are terminal', () => {
    expect(
      resolveCurrentPipelineStage([
        { name: 'Build', status: 'SUCCESS' },
        { name: 'Deploy', status: 'SUCCESS' },
      ]),
    ).toBeNull();
  });

  it('returns null for empty or missing stages', () => {
    expect(resolveCurrentPipelineStage([])).toBeNull();
    expect(resolveCurrentPipelineStage(undefined)).toBeNull();
  });

  it('returns the first non-terminal stage when multiple are active', () => {
    expect(
      resolveCurrentPipelineStage([
        { name: 'Unit', status: 'IN_PROGRESS' },
        { name: 'Integration', status: 'IN_PROGRESS' },
      ]),
    ).toBe('Unit');
  });
});

describe('fetchJenkinsPipelineStage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the current stage from wfapi describe', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        stages: [
          { name: 'Build', status: 'SUCCESS' },
          { name: 'Deploy', status: 'IN_PROGRESS' },
        ],
      }),
    } as Response);

    await expect(
      fetchJenkinsPipelineStage(
        'https://jenkins.example.net/job/my-job',
        42,
        'dG9rZW4=',
      ),
    ).resolves.toBe('Deploy');
  });

  it('returns null when wfapi is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(
      fetchJenkinsPipelineStage(
        'https://jenkins.example.net/job/my-job',
        42,
        'dG9rZW4=',
      ),
    ).resolves.toBeNull();
  });
});
