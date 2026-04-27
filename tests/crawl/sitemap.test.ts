import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseSitemapUrls, isSitemapIndex } from '@/lib/crawl/sitemap';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '..', 'fixtures');

describe('sitemap parser', () => {
  it('extracts <loc> entries from urlset XML', () => {
    const xml = readFileSync(join(fixtures, 'sitemap-guides.xml'), 'utf8');
    const urls = parseSitemapUrls(xml);
    expect(urls.length).toBeGreaterThan(20);
    expect(urls[0]).toMatch(/^https:\/\/guides\.delta\.exchange\//);
    expect(urls.every((u) => u.startsWith('https://'))).toBe(true);
  });

  it('detects a sitemapindex', () => {
    const indexXml = `<?xml version="1.0"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/child.xml</loc></sitemap>
      </sitemapindex>`;
    expect(isSitemapIndex(indexXml)).toBe(true);

    const urlsetXml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page</loc></url>
      </urlset>`;
    expect(isSitemapIndex(urlsetXml)).toBe(false);
  });

  it('handles malformed/empty input gracefully', () => {
    expect(parseSitemapUrls('')).toEqual([]);
    expect(parseSitemapUrls('<not><a><sitemap/>')).toEqual([]);
  });

  it('trims whitespace inside <loc>', () => {
    const xml = `<urlset><url><loc>
      https://example.com/foo
    </loc></url></urlset>`;
    expect(parseSitemapUrls(xml)).toEqual(['https://example.com/foo']);
  });
});
