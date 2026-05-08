import { config as loadEnv } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { fetchJson, fetchText, Throttle } from '@/lib/crawl/fetch';

loadEnv({ path: '.env.local' });

const INDIA_PORTAL_ID = 80000083721;
const FD_DOMAIN = process.env.FRESHDESK_DOMAIN!;
const FD_KEY = process.env.FRESHDESK_API_KEY!;
const SUPPORT_URL_BASE = 'https://www.delta.exchange/support/solutions/articles';

if (!FD_DOMAIN || !FD_KEY) {
  console.error('FRESHDESK_DOMAIN and FRESHDESK_API_KEY must be set');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${FD_KEY}:X`).toString('base64')}`;
const headers = { Authorization: auth };

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
  status: number;
  type?: number;
  agent_id?: number;
  category_id?: number;
  folder_id?: number;
  updated_at: string;
  description?: string;
}

interface ClassifiedArticle {
  id: number;
  title: string;
  status: number;
  fd_url: string;
  delta_url: string;
  category_id: number;
  category_name: string;
  category_in_india_portal: boolean;
  folder_id: number;
  folder_name: string;
  folder_visibility: number;
  delta_returns_content: boolean | null; // null = not checked
  reason: string; // why missing from M6 sweep, if applicable
}

async function main(): Promise<void> {
  const fdThrottle = new Throttle(3);
  const deltaThrottle = new Throttle(3);

  console.log('Step 1: enumerate all Freshdesk articles...');
  const cats = await fetchJson<FdCategory[]>(
    `https://${FD_DOMAIN}/api/v2/solutions/categories`,
    { headers },
  );
  console.log(`  ${cats.length} categories total`);
  const indiaCats = cats.filter((c) => c.visible_in_portals?.includes(INDIA_PORTAL_ID));
  const nonIndiaCats = cats.filter((c) => !c.visible_in_portals?.includes(INDIA_PORTAL_ID));
  console.log(`  ${indiaCats.length} in India portal, ${nonIndiaCats.length} not in India portal`);
  console.log(`  not-India categories: ${nonIndiaCats.map((c) => c.name).join(', ')}`);

  const all: ClassifiedArticle[] = [];

  for (const cat of cats) {
    const inIndia = !!cat.visible_in_portals?.includes(INDIA_PORTAL_ID);
    await fdThrottle.wait();
    const folders = await fetchJson<FdFolder[]>(
      `https://${FD_DOMAIN}/api/v2/solutions/categories/${cat.id}/folders`,
      { headers },
    );
    for (const folder of folders) {
      if (folder.articles_count === 0) continue;
      let page = 1;
      while (true) {
        await fdThrottle.wait();
        const articles = await fetchJson<FdArticle[]>(
          `https://${FD_DOMAIN}/api/v2/solutions/folders/${folder.id}/articles?per_page=100&page=${page}`,
          { headers },
        );
        if (articles.length === 0) break;
        for (const a of articles) {
          all.push({
            id: a.id,
            title: a.title,
            status: a.status,
            fd_url: `https://${FD_DOMAIN}/support/solutions/articles/${a.id}`,
            delta_url: `${SUPPORT_URL_BASE}/${a.id}`,
            category_id: cat.id,
            category_name: cat.name,
            category_in_india_portal: inIndia,
            folder_id: folder.id,
            folder_name: folder.name,
            folder_visibility: folder.visibility,
            delta_returns_content: null,
            reason: '',
          });
        }
        if (articles.length < 100) break;
        page += 1;
      }
    }
  }
  console.log(`  ${all.length} total articles enumerated`);
  console.log(`    by status: ${countBy(all, (a) => a.status)}`);

  // Pre-classify based on Freshdesk-side rules
  for (const a of all) {
    if (a.status !== 2) {
      a.reason = 'draft (Freshdesk status != 2)';
    } else if (!a.category_in_india_portal) {
      a.reason = `category '${a.category_name}' not visible in India portal`;
    } else if (a.folder_visibility !== 1) {
      a.reason = `folder visibility=${a.folder_visibility} (logged-in or restricted)`;
    }
  }

  console.log('\nStep 2: probe delta.exchange page for each India-visible published article...');
  const candidates = all.filter((a) => a.status === 2 && a.category_in_india_portal && a.folder_visibility === 1);
  console.log(`  ${candidates.length} candidates that SHOULD render on delta.exchange`);

  let n = 0;
  for (const a of candidates) {
    n += 1;
    await deltaThrottle.wait();
    try {
      const html = await fetchText(a.delta_url);
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) {
        a.delta_returns_content = false;
        a.reason = 'delta.exchange page has no __NEXT_DATA__';
        continue;
      }
      const data = JSON.parse(m[1]!);
      const ac = data.props?.pageProps?.articleContent;
      if (ac && ac.description) {
        a.delta_returns_content = true;
      } else {
        a.delta_returns_content = false;
        a.reason = 'delta.exchange returns null articleContent';
      }
    } catch (e) {
      a.delta_returns_content = false;
      const code = (e as { status?: number }).status;
      a.reason = `delta.exchange fetch ${code ?? 'error'}: ${(e as Error).message.slice(0, 60)}`;
    }
    if (n % 25 === 0) console.log(`  progress: ${n}/${candidates.length}`);
  }

  // Summarize
  const summary = {
    total_freshdesk_articles: all.length,
    drafts: all.filter((a) => a.status !== 2).length,
    not_in_india_portal: all.filter((a) => a.status === 2 && !a.category_in_india_portal).length,
    folder_visibility_restricted: all.filter(
      (a) => a.status === 2 && a.category_in_india_portal && a.folder_visibility !== 1,
    ).length,
    in_india_no_delta_content: all.filter(
      (a) =>
        a.status === 2 &&
        a.category_in_india_portal &&
        a.folder_visibility === 1 &&
        a.delta_returns_content === false,
    ).length,
    surfaced_on_delta: all.filter((a) => a.delta_returns_content === true).length,
  };

  console.log('\n=== Summary ===');
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);

  // Write CSV
  const csvLines = ['id,status,category,category_in_india_portal,folder,folder_visibility,delta_returns_content,reason,fd_url,delta_url,title'];
  for (const a of all) {
    const fields = [
      a.id,
      a.status,
      escapeCsv(a.category_name),
      a.category_in_india_portal,
      escapeCsv(a.folder_name),
      a.folder_visibility,
      a.delta_returns_content ?? '',
      escapeCsv(a.reason),
      a.fd_url,
      a.delta_url,
      escapeCsv(a.title),
    ];
    csvLines.push(fields.join(','));
  }
  const csvPath = `docs/M6-missing-articles-${new Date().toISOString().slice(0, 10)}.csv`;
  writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`\nFull breakdown: ${csvPath}`);

  // List the missing ones explicitly
  const missing = all.filter((a) => a.reason);
  console.log(`\nMissing/excluded articles (${missing.length}):`);
  const grouped = new Map<string, ClassifiedArticle[]>();
  for (const a of missing) {
    if (!grouped.has(a.reason)) grouped.set(a.reason, []);
    grouped.get(a.reason)!.push(a);
  }
  for (const [reason, items] of grouped) {
    console.log(`\n  [${items.length}] ${reason}:`);
    for (const a of items.slice(0, 5)) {
      console.log(`    ${a.id} · ${a.title.slice(0, 70)} · ${a.delta_url}`);
    }
    if (items.length > 5) console.log(`    ... +${items.length - 5} more (see CSV)`);
  }
}

function escapeCsv(s: string): string {
  if (s == null) return '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function countBy<T, K extends string | number>(arr: T[], k: (x: T) => K): string {
  const counts: Record<string, number> = {};
  for (const x of arr) {
    const key = String(k(x));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return JSON.stringify(counts);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
