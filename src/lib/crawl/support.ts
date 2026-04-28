import { fetchJson, fetchText, Throttle } from './fetch';
import { normalize } from './normalize';
import type { Article } from '@/lib/types';

// India portal id (Freshdesk's `visible_in_portals` field). Categories not in
// this portal are not surfaced on delta.exchange/support to India users.
const INDIA_PORTAL_ID = 80000083721;

const SUPPORT_BASE_URL = 'https://www.delta.exchange/support/solutions/articles';

interface FdCategory {
  id: number;
  name: string;
  visible_in_portals: number[];
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
  /** Freshdesk subdomain (e.g. `deltaexchange.freshdesk.com`). Used ONLY to enumerate
   *  article IDs + metadata. Article CONTENT is fetched from delta.exchange. */
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

interface DeltaArticleContent {
  id: number;
  title: string;
  description: string;
  description_text?: string;
  status?: number;
  updated_at?: string;
}

/**
 * Fetch one article's content from delta.exchange/support/solutions/articles/<id>.
 * The page is server-rendered Next.js — the article body lives in
 * __NEXT_DATA__.props.pageProps.articleContent.description (HTML).
 *
 * Returns null when the URL 404s or when the page renders without articleContent
 * (article exists in Freshdesk but isn't surfaced on the India portal).
 */
async function fetchDeltaArticle(id: number): Promise<DeltaArticleContent | null> {
  let html: string;
  try {
    html = await fetchText(`${SUPPORT_BASE_URL}/${id}`);
  } catch {
    return null;
  }
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data: unknown;
  try {
    data = JSON.parse(m[1]!);
  } catch {
    return null;
  }
  const ac = (data as { props?: { pageProps?: { articleContent?: DeltaArticleContent | null } } })
    .props?.pageProps?.articleContent;
  return ac ?? null;
}

/**
 * Crawl the India support center. Enumeration uses the Freshdesk Solutions API
 * (the only feasible path — delta.exchange exposes categories + folders but not
 * article lists). Content is fetched from delta.exchange URLs so audit findings
 * link to the user-facing surface.
 */
export async function* crawl(cfg: FreshdeskConfig = configFromEnv()): AsyncGenerator<Article> {
  const fdThrottle = new Throttle(cfg.rps ?? 2); // Freshdesk API
  const deltaThrottle = new Throttle(cfg.rps ?? 2); // delta.exchange page fetches
  const headers = { Authorization: authHeader(cfg.apiKey) };

  await fdThrottle.wait();
  const categories = await fetchJson<FdCategory[]>(
    `https://${cfg.domain}/api/v2/solutions/categories`,
    { headers },
  );

  for (const cat of categories) {
    if (!cat.visible_in_portals?.includes(INDIA_PORTAL_ID)) continue;

    await fdThrottle.wait();
    const folders = await fetchJson<FdFolder[]>(
      `https://${cfg.domain}/api/v2/solutions/categories/${cat.id}/folders`,
      { headers },
    );

    for (const folder of folders) {
      if (folder.articles_count === 0) continue;
      if (folder.visibility !== 1) continue;
      let page = 1;
      while (true) {
        await fdThrottle.wait();
        const articles = await fetchJson<FdArticle[]>(
          `https://${cfg.domain}/api/v2/solutions/folders/${folder.id}/articles?per_page=100&page=${page}`,
          { headers },
        );
        if (articles.length === 0) break;
        for (const a of articles) {
          if (a.status !== 2) continue;

          // Fetch CONTENT from delta.exchange (not Freshdesk).
          await deltaThrottle.wait();
          const delta = await fetchDeltaArticle(a.id);
          if (!delta || !delta.description) {
            // Article exists in Freshdesk but isn't surfaced on delta.exchange.
            // Skip silently — the audit target is what users see.
            continue;
          }

          const { text } = normalize(delta.description, 'support');
          yield {
            source: 'support',
            stableId: String(a.id),
            url: `${SUPPORT_BASE_URL}/${a.id}`,
            title: delta.title || a.title,
            text,
            html: delta.description,
            lastModified: delta.updated_at ?? a.updated_at,
          };
        }
        if (articles.length < 100) break;
        page += 1;
      }
    }
  }
}
