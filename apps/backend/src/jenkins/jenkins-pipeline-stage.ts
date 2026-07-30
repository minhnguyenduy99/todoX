const TERMINAL_STAGE_STATUSES = new Set([
  'SUCCESS',
  'FAILED',
  'FAILURE',
  'ABORTED',
  'NOT_EXECUTED',
  'SKIPPED',
]);

export interface JenkinsPipelineStage {
  name: string;
  status: string;
}

export interface JenkinsWfapiDescribeResponse {
  stages?: JenkinsPipelineStage[];
}

export function resolveCurrentPipelineStage(
  stages: JenkinsPipelineStage[] | undefined,
): string | null {
  if (!stages?.length) return null;

  const runningStage = stages.find((stage) => !TERMINAL_STAGE_STATUSES.has(stage.status));
  if (!runningStage?.name?.trim()) return null;
  return runningStage.name.trim();
}

export async function fetchJenkinsPipelineStage(
  jobUrl: string,
  buildNumber: number,
  auth: string,
): Promise<string | null> {
  const baseUrl = jobUrl.replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/${buildNumber}/wfapi/describe`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as JenkinsWfapiDescribeResponse;
    return resolveCurrentPipelineStage(payload.stages);
  } catch {
    return null;
  }
}
