import { describe, it, expect } from 'vitest';
import { chunkArticle, splitByBoundaries } from '@/lib/embed/chunker';
import type { Article } from '@/lib/types';

function makeArticle(text: string, source: 'guides' | 'docs' = 'guides'): Article {
  return {
    source,
    stableId: 'test/article',
    url: 'https://example.com/test',
    title: 'Test Article',
    text,
    html: '',
  };
}

describe('chunkArticle', () => {
  it('returns empty array for empty input', () => {
    expect(chunkArticle(makeArticle(''))).toEqual([]);
    expect(chunkArticle(makeArticle('   \n\n  '))).toEqual([]);
  });

  it('returns one chunk when text fits in budget', () => {
    const chunks = chunkArticle(makeArticle('short body'), { maxChars: 200 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.id).toBe('guides:test/article#0');
    expect(chunks[0]?.text).toBe('short body');
    expect(chunks[0]?.metadata.chunkIndex).toBe(0);
    expect(chunks[0]?.metadata.source).toBe('guides');
    expect(chunks[0]?.metadata.articleStableId).toBe('test/article');
  });

  it('splits long text into multiple chunks with sequential indices', () => {
    const para = 'word '.repeat(100); // 500 chars
    const text = [para, para, para, para].join('\n\n'); // 4 paras × 500 = ~2000+ chars with separators
    const chunks = chunkArticle(makeArticle(text), { maxChars: 800, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => {
      expect(c.metadata.chunkIndex).toBe(i);
      expect(c.id).toBe(`guides:test/article#${i}`);
    });
  });

  it('produces idempotent IDs across runs', () => {
    const text = 'paragraph one. ' + 'word '.repeat(500);
    const a = chunkArticle(makeArticle(text), { maxChars: 800 });
    const b = chunkArticle(makeArticle(text), { maxChars: 800 });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a.map((c) => c.text)).toEqual(b.map((c) => c.text));
  });

  it('respects paragraph boundaries when possible', () => {
    const p1 = 'p1. ' + 'a '.repeat(200); // ~404 chars
    const p2 = 'p2. ' + 'b '.repeat(200); // ~404 chars
    const text = [p1, p2].join('\n\n');
    const chunks = chunkArticle(makeArticle(text), { maxChars: 500, overlap: 50 });
    // Each para fits in its own chunk; should produce 2 chunks split at paragraph boundary
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.text).toContain('p1.');
    expect(chunks[1]?.text).toContain('p2.');
  });
});

describe('splitByBoundaries', () => {
  it('splits a paragraph that exceeds maxChars on its own', () => {
    const big = 'x'.repeat(3000);
    const segments = splitByBoundaries(big, 1000, 100);
    expect(segments.length).toBeGreaterThan(2);
    for (const s of segments) expect(s.length).toBeLessThanOrEqual(1000);
  });

  it('returns single segment for short text', () => {
    expect(splitByBoundaries('hello', 100, 10)).toEqual(['hello']);
  });
});
