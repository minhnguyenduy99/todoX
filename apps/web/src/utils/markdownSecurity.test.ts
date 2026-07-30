import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedMarkdownUrl, transformMarkdownUrl } from './markdownSecurity.js';

describe('isAllowedMarkdownUrl', () => {
  it('allows https URLs', () => {
    assert.equal(isAllowedMarkdownUrl('https://example.com/path'), true);
  });

  it('allows http URLs', () => {
    assert.equal(isAllowedMarkdownUrl('http://example.com'), true);
  });

  it('allows relative paths', () => {
    assert.equal(isAllowedMarkdownUrl('/docs/page'), true);
  });

  it('rejects empty strings', () => {
    assert.equal(isAllowedMarkdownUrl(''), false);
    assert.equal(isAllowedMarkdownUrl('   '), false);
  });

  it('rejects javascript URLs', () => {
    assert.equal(isAllowedMarkdownUrl('javascript:alert(1)'), false);
  });

  it('rejects data URLs', () => {
    assert.equal(isAllowedMarkdownUrl('data:text/html,<script>alert(1)</script>'), false);
  });

  it('rejects vbscript URLs', () => {
    assert.equal(isAllowedMarkdownUrl('vbscript:msgbox(1)'), false);
  });
});

describe('transformMarkdownUrl', () => {
  it('passes through allowed URLs unchanged', () => {
    assert.equal(transformMarkdownUrl('https://example.com'), 'https://example.com');
    assert.equal(transformMarkdownUrl('/docs/page'), '/docs/page');
  });

  it('returns empty string for blocked URLs', () => {
    assert.equal(transformMarkdownUrl('javascript:alert(1)'), '');
    assert.equal(transformMarkdownUrl('data:text/html,test'), '');
    assert.equal(transformMarkdownUrl('vbscript:msgbox(1)'), '');
  });
});
