import { config as loadEnv } from 'dotenv';
import { SOURCES, type Source, type Article } from '@/lib/types';
import { sha256, hashKey, diff, loadHash, storeHash } from '@/lib/store/hash';
import { kv } from '@/lib/store/kv';
import { crawl as crawlGuides } from '@/lib/crawl/guides';
import { crawl as crawlDocs } from '@/lib/crawl/docs';
import { crawl as crawlSupport } from '@/lib/crawl/support';

loadEnv({ path: '.env.local' });

interface Args {
  source: Source | 'all';
  write: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  let source: Source | 'all' = 'all';
  let write = false;
  let limit: number | undefined;
  for (const a of argv.slice(2)) {
    if (a === '--write') write = true;
    else if (a.startsWith('--source=')) {
      const s = a.slice('--source='.length);
      if (s !== 'all' && !SOURCES.includes(s as Source)) {
        throw new Error(`--source must be one of: all, ${SOURCES.join(', ')}`);
      }
      source = s as Source | 'all';
    } else if (a.startsWith('--limit=')) {
      limit = Number(a.slice('--limit='.length));
      if (!Number.isFinite(limit) || limit <= 0) throw new Error('--limit must be a positive int');
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }
  return { source, write, limit };
}

function printHelp(): void {
  console.log(
    [
      'Usage: pnpm crawl [--source=all|guides|docs|support] [--write] [--limit=N]',
      '',
      '  --source     Which crawler to run (default: all)',
      '  --write      Persist hashes to Upstash Redis (default: dry-run)',
      '  --limit      Cap articles per source (debugging)',
    ].join('\n'),
  );
}

async function* runCrawler(source: Source): AsyncGenerator<Article> {
  if (source === 'guides') yield* crawlGuides();
  else if (source === 'docs') yield* crawlDocs();
  else if (source === 'support') yield* crawlSupport();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sources: Source[] = args.source === 'all' ? [...SOURCES] : [args.source];
  const now = new Date().toISOString();

  const stats = { total: 0, changed: 0, new: 0, unchanged: 0, errors: 0 };
  const redis = args.write ? kv() : null;

  console.log(
    `\nCrawl-once · sources=[${sources.join(',')}] · ${args.write ? 'WRITE' : 'dry-run'}${
      args.limit ? ` · limit=${args.limit}` : ''
    }\n`,
  );
  console.log(
    'source              | stableId                                   | sha8     | changed | bytes',
  );
  console.log(
    '--------------------|--------------------------------------------|----------|---------|------',
  );

  for (const src of sources) {
    let count = 0;
    try {
      for await (const article of runCrawler(src)) {
        if (args.limit && count >= args.limit) break;
        const sha = sha256(article.text);
        let row: 'NEW' | 'CHANGED' | 'unchanged' = 'NEW';
        if (redis) {
          const key = hashKey(src, article.stableId);
          const prev = await loadHash(redis, key);
          const d = diff(prev, sha, now);
          row = d.isNew ? 'NEW' : d.changed ? 'CHANGED' : 'unchanged';
          await storeHash(redis, key, d.next);
          if (d.isNew) stats.new += 1;
          else if (d.changed) stats.changed += 1;
          else stats.unchanged += 1;
        } else {
          row = 'NEW'; // dry-run treats everything as new (no comparison)
          stats.new += 1;
        }
        const idCol = article.stableId.padEnd(42).slice(0, 42);
        console.log(
          `${src.padEnd(20)}| ${idCol} | ${sha.slice(0, 8)} | ${row.padEnd(7)} | ${article.text.length}`,
        );
        stats.total += 1;
        count += 1;
      }
    } catch (e) {
      stats.errors += 1;
      console.error(`\n[${src}] ERROR:`, (e as Error).message);
    }
  }

  console.log(
    `\nSummary: total=${stats.total} new=${stats.new} changed=${stats.changed} unchanged=${stats.unchanged} errors=${stats.errors}`,
  );
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
