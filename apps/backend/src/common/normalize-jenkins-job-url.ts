export function normalizeJenkinsJobUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  const match = trimmed.match(/^(.*)\/(\d+)$/);
  if (!match) {
    return trimmed;
  }

  const buildNumber = Number.parseInt(match[2], 10);
  if (!Number.isFinite(buildNumber) || buildNumber < 1) {
    return trimmed;
  }

  return match[1];
}
