import { fetchSitemap } from './sitemap';
import { fetchText, Throttle } from './fetch';
import { normalize } from './normalize';
import type { Article } from '@/lib/types';

const SITEMAP_URL =
  'https://guides.delta.exchange/delta-exchange-india-user-guide/sitemap.xml';
const URL_PREFIX = 'https://guides.delta.exchange/delta-exchange-india-user-guide/';

export function stableIdFromUrl(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  if (trimmed === URL_PREFIX.replace(/\/$/, '')) return 'index';
  if (!trimmed.startsWith(URL_PREFIX)) return trimmed;
  return trimmed.slice(URL_PREFIX.length);
}

export async function* crawl(): AsyncGenerator<Article> {
  const urls = await fetchSitemap(SITEMAP_URL);
  const throttle = new Throttle(2);
  for (const url of urls) {
    await throttle.wait();
    const html = await fetchText(url);
    const { title, text } = normalize(html, 'guides');
    yield {
      source: 'guides',
      stableId: stableIdFromUrl(url),
      url,
      title,
      text,
      html,
    };
  }
}
