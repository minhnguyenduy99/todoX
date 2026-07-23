export const CHANGELOG_SECTION_HEADING = '## Changelog by service';

export type TodoChangelogMember = {
  title: string;
  changelog: string | null;
  service: {
    keyName: string;
    displayName: string | null;
  } | null;
};

function normalizeChangelog(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serviceHeading(service: TodoChangelogMember['service']): string {
  if (!service) {
    return 'Unknown service';
  }
  return service.displayName?.trim() || service.keyName;
}

function formatTodoBullet(title: string, changelog: string): string {
  const singleLine = changelog.replace(/\s+/g, ' ').trim();
  return `- **${title}** — ${singleLine}`;
}

export function assembleTodoChangelogSection(
  members: TodoChangelogMember[],
): string | null {
  const byService = new Map<string, { heading: string; lines: string[] }>();

  for (const member of members) {
    const changelog = normalizeChangelog(member.changelog);
    if (!changelog) {
      continue;
    }

    const heading = serviceHeading(member.service);
    const key = member.service?.keyName ?? heading;
    const group = byService.get(key) ?? { heading, lines: [] };
    group.lines.push(formatTodoBullet(member.title, changelog));
    byService.set(key, group);
  }

  if (byService.size === 0) {
    return null;
  }

  const sections = [...byService.values()]
    .sort((a, b) => a.heading.localeCompare(b.heading, undefined, { sensitivity: 'base' }))
    .map((group) => {
      const sortedLines = group.lines.sort((a, b) => a.localeCompare(b));
      return `### ${group.heading}\n${sortedLines.join('\n')}`;
    });

  return `${CHANGELOG_SECTION_HEADING}\n\n${sections.join('\n\n')}`;
}

export function extractReleasePreamble(content: string): string {
  const delimiter = `\n\n${CHANGELOG_SECTION_HEADING}\n`;
  const delimiterIndex = content.indexOf(delimiter);
  if (delimiterIndex !== -1) {
    return content.slice(0, delimiterIndex).trim();
  }
  if (content.startsWith(`${CHANGELOG_SECTION_HEADING}\n`)) {
    return '';
  }
  return content.trim();
}

export function mergeReleaseContent(
  preamble: string | null | undefined,
  assembled: string | null,
): string {
  const trimmedPreamble = preamble?.trim() ?? '';
  if (!assembled) {
    return trimmedPreamble;
  }
  if (!trimmedPreamble) {
    return assembled;
  }
  return `${trimmedPreamble}\n\n${assembled}`;
}
