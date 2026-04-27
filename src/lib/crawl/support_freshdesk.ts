import { fetchJson, Throttle } from './fetch';
import { normalize } from './normalize';
import type { Article } from '@/lib/types';

interface FdCategory {
  id: number;
  name: string;
}

interface FdFolder {
  id: number;
  name: string;
  articles_count: number;
  visibility: number;
}

interface FdArticle {
  id: number;
  title: string;
  description: string;
  description_text?: string;
  status: number;
  updated_at: string;
}

export interface FreshdeskConfig {
  domain: string;
  apiKey: string;
  rps?: number;
}

export function configFromEnv(): FreshdeskConfig {
  const domain = process.env.FRESHDESK_DOMAIN;
  const apiKey = process.env.FRESHDESK_API_KEY;
  if (!domain) throw new Error('FRESHDESK_DOMAIN env var is required');
  if (!apiKey) throw new Error('FRESHDESK_API_KEY env var is required');
  return { domain, apiKey };
}

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:X`).toString('base64')}`;
}

export async function* crawl(cfg: FreshdeskConfig = configFromEnv()): AsyncGenerator<Article> {
  const throttle = new Throttle(cfg.rps ?? 2);
  const headers = { Authorization: authHeader(cfg.apiKey) };

  await throttle.wait();
  const categories = await fetchJson<FdCategory[]>(
    `https://${cfg.domain}/api/v2/solutions/categories`,
    { headers },
  );

  for (const cat of categories) {
    await throttle.wait();
    const folders = await fetchJson<FdFolder[]>(
      `https://${cfg.domain}/api/v2/solutions/categories/${cat.id}/folders`,
      { headers },
    );
    for (const folder of folders) {
      if (folder.articles_count === 0) continue;
      if (folder.visibility !== 1) continue;
      let page = 1;
      while (true) {
        await throttle.wait();
        const articles = await fetchJson<FdArticle[]>(
          `https://${cfg.domain}/api/v2/solutions/folders/${folder.id}/articles?per_page=100&page=${page}`,
          { headers },
        );
        if (articles.length === 0) break;
        for (const a of articles) {
          if (a.status !== 2) continue;
          const html = a.description ?? '';
          const { text } = normalize(html, 'support_freshdesk');
          yield {
            source: 'support_freshdesk',
            stableId: String(a.id),
            url: `https://${cfg.domain}/support/solutions/articles/${a.id}`,
            title: a.title,
            text,
            html,
            lastModified: a.updated_at,
          };
        }
        if (articles.length < 100) break;
        page += 1;
      }
    }
  }
}
