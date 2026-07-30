const BLOCKED_SCHEME_PATTERN = /^(javascript|data|vbscript):/i;

export function isAllowedMarkdownUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  if (BLOCKED_SCHEME_PATTERN.test(trimmed)) {
    return false;
  }

  return true;
}

export function transformMarkdownUrl(url: string): string {
  return isAllowedMarkdownUrl(url) ? url : '';
}
