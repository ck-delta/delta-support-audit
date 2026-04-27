import { fetchText } from './fetch.js';

export function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) urls.push(m[1]);
  }
  return urls;
}

export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex\b/i.test(xml);
}

export async function fetchSitemap(url: string): Promise<string[]> {
  const xml = await fetchText(url);
  const locs = parseSitemapUrls(xml);
  if (!isSitemapIndex(xml)) return locs;
  const all: string[] = [];
  for (const childUrl of locs) {
    const child = await fetchText(childUrl);
    all.push(...parseSitemapUrls(child));
  }
  return all;
}
