import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chunk } from '@/lib/crawl/docs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '..', 'fixtures');

describe('docs chunker (Slate single-page)', () => {
  it('emits multiple chunks from the docs excerpt', () => {
    const html = readFileSync(join(fixtures, 'docs-excerpt.html'), 'utf8');
    const chunks = Array.from(chunk(html));
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.source).toBe('docs');
      expect(c.url).toMatch(/^https:\/\/docs\.delta\.exchange\/#/);
      expect(c.stableId.length).toBeGreaterThan(0);
      expect(c.text.length).toBeGreaterThanOrEqual(30);
      expect(c.title.length).toBeGreaterThan(0);
    }
  });

  it('uses heading id when present, slug fallback otherwise', () => {
    const html = `<html><body>
      <h2 id="auth-section">Auth</h2><p>Body for auth section. ${'x'.repeat(50)}</p>
      <h2>Untagged Heading</h2><p>Body for untagged. ${'y'.repeat(50)}</p>
    </body></html>`;
    const chunks = Array.from(chunk(html));
    expect(chunks[0]?.stableId).toBe('auth-section');
    expect(chunks[1]?.stableId).toBe('untagged-heading');
  });

  it('skips chunks shorter than 30 chars', () => {
    const html = `<html><body><h2 id="x">x</h2><p>tiny</p></body></html>`;
    const chunks = Array.from(chunk(html));
    expect(chunks).toHaveLength(0);
  });
});
