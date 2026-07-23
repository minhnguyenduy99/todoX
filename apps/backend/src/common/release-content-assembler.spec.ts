import {
  assembleTodoChangelogSection,
  extractReleasePreamble,
  mergeReleaseContent,
} from './release-content-assembler';

describe('release-content-assembler', () => {
  const billingService = {
    keyName: 'billing-api',
    displayName: 'Billing API',
  };

  const authService = {
    keyName: 'auth',
    displayName: 'Auth',
  };

  describe('assembleTodoChangelogSection', () => {
    it('groups todos by service and omits empty changelogs', () => {
      const result = assembleTodoChangelogSection([
        {
          title: 'Fix rounding',
          changelog: 'Fixed cent-level rounding.',
          service: billingService,
        },
        {
          title: 'No notes',
          changelog: null,
          service: billingService,
        },
        {
          title: 'Extend TTL',
          changelog: 'Sessions now expire after 24 hours.',
          service: authService,
        },
      ]);

      expect(result).toContain('## Changelog by service');
      expect(result).toContain('### Auth');
      expect(result).toContain('### Billing API');
      expect(result).toContain('- **Extend TTL** — Sessions now expire after 24 hours.');
      expect(result).toContain('- **Fix rounding** — Fixed cent-level rounding.');
      expect(result).not.toContain('No notes');
    });

    it('returns null when no member has changelog text', () => {
      expect(
        assembleTodoChangelogSection([
          { title: 'Todo', changelog: '   ', service: billingService },
        ]),
      ).toBeNull();
    });

    it('collapses internal newlines in changelog text', () => {
      const result = assembleTodoChangelogSection([
        {
          title: 'Multi line',
          changelog: 'Line one\nLine two',
          service: billingService,
        },
      ]);

      expect(result).toContain('- **Multi line** — Line one Line two');
    });
  });

  describe('extractReleasePreamble', () => {
    it('returns text before the changelog section marker', () => {
      const content = mergeReleaseContent('March staging cut', '## Changelog by service\n\n### Auth\n- **x** — y');
      expect(extractReleasePreamble(content)).toBe('March staging cut');
    });

    it('returns empty string when content is only the changelog section', () => {
      expect(extractReleasePreamble('## Changelog by service\n\n### Auth\n- **x** — y')).toBe('');
    });
  });

  describe('mergeReleaseContent', () => {
    it('appends assembled section after preamble', () => {
      const assembled = assembleTodoChangelogSection([
        {
          title: 'Fix rounding',
          changelog: 'Fixed rounding.',
          service: billingService,
        },
      ]);

      const merged = mergeReleaseContent('March staging cut', assembled);
      expect(merged.startsWith('March staging cut')).toBe(true);
      expect(merged).toContain('## Changelog by service');
    });

    it('returns preamble only when assembled section is null', () => {
      expect(mergeReleaseContent('Notes only', null)).toBe('Notes only');
    });
  });
});
