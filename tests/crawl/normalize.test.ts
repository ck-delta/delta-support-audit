import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalize } from '@/lib/crawl/normalize';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '..', 'fixtures');
const read = (name: string) => readFileSync(join(fixtures, name), 'utf8');

describe('normalize — guides (GitBook)', () => {
  it('extracts the leverage article body', () => {
    const html = read('guides-leverage.html');
    const { text, headings, title } = normalize(html, 'guides');
    expect(title).toMatch(/Leverage/i);
    expect(text).toMatch(/Position Leverage/);
    expect(text.length).toBeGreaterThan(500);
    expect(headings.some((h) => /Leverage/i.test(h.text))).toBe(true);
  });

  it('strips scripts, styles, and CSS noise from the page', () => {
    const html = read('guides-leverage.html');
    const { text } = normalize(html, 'guides');
    expect(text).not.toMatch(/<script/i);
    expect(text).not.toMatch(/<style/i);
    expect(text).not.toMatch(/--primary-1:/);
    expect(text).not.toMatch(/function f\(\)/);
  });

  it('produces stable output (deterministic for hashing)', () => {
    const html = read('guides-leverage.html');
    const a = normalize(html, 'guides').text;
    const b = normalize(html, 'guides').text;
    expect(a).toBe(b);
  });
});

describe('normalize — docs (Slate)', () => {
  it('preserves heading-rich body content', () => {
    const html = read('docs-excerpt.html');
    const { text, headings } = normalize(html, 'docs');
    expect(text.length).toBeGreaterThan(1000);
    expect(headings.length).toBeGreaterThan(3);
  });

  it('strips scripts/styles', () => {
    const html = read('docs-excerpt.html');
    const { text } = normalize(html, 'docs');
    expect(text).not.toMatch(/<script/i);
    expect(text).not.toMatch(/<style/i);
  });
});

describe('normalize — support_freshdesk (article)', () => {
  it('extracts article body and ignores page chrome', () => {
    const html = read('support_freshdesk-article.html');
    const { text } = normalize(html, 'support_freshdesk');
    expect(text.length).toBeGreaterThan(50);
    expect(text).not.toMatch(/Cookie policy/i);
    expect(text).not.toMatch(/<script/i);
  });
});

describe('normalize — edge cases', () => {
  it('preserves code blocks but strips nav/footer', () => {
    const html = read('edge-codeblock.html');
    const { text, headings, title } = normalize(html, 'guides');
    expect(title).toBe('Code Block Test');
    expect(text).toMatch(/Bearer \$TOKEN/);
    expect(text).toMatch(/Authenticate using/);
    expect(text).toMatch(/Rate limits/);
    expect(text).not.toMatch(/should be stripped/);
    expect(headings.map((h) => h.text)).toEqual(['API authentication', 'Rate limits']);
  });
});
