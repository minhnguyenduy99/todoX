export interface ParsedJenkinsJobUrl {
  jobUrl: string;
  buildNumber: number;
}

export function parseJenkinsJobUrl(input: string): ParsedJenkinsJobUrl {
  const trimmed = input.trim().replace(/\/+$/, '');
  const match = trimmed.match(/^(.*)\/(\d+)$/);
  if (!match) {
    throw new Error(
      'Invalid Jenkins job URL: expected a build URL ending with /buildNumber',
    );
  }

  const buildNumber = Number.parseInt(match[2], 10);
  if (!Number.isFinite(buildNumber) || buildNumber < 1) {
    throw new Error('Invalid Jenkins build number in URL');
  }

  return {
    jobUrl: match[1],
    buildNumber,
  };
}
