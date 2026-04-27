import { config as loadEnv } from 'dotenv';
import type { Article, Source } from '@/lib/types.js';
import { sha256 } from '@/lib/store/hash.js';
import { kv } from '@/lib/store/kv.js';
import { vec, upsertChunks, deleteChunks, retrieveTopK } from '@/lib/store/vector.js';
import { chunkArticle } from '@/lib/embed/chunker.js';
import { crawl as crawlGuides } from '@/lib/crawl/guides.js';
import { crawl as crawlDocs } from '@/lib/crawl/docs.js';

loadEnv({ path: '.env.local' });

type SotSource = Exclude<Source, 'support_freshdesk'>;
const SOT_SOURCES: SotSource[] = ['guides', 'docs'];

interface Args {
  source: SotSource | 'all';
  force: boolean;
  dryRun: boolean;
  sampleQuery?: string;
  sampleK: number;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { source: 'all', force: false, dryRun: false, sampleK: 5 };
  for (const a of argv.slice(2)) {
    if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--source=')) {
      const s = a.slice('--source='.length) as SotSource | 'all';
      if (s !== 'all' && !SOT_SOURCES.includes(s as SotSource)) {
        throw new Error(`--source must be one of: all, ${SOT_SOURCES.join(', ')}`);
      }
      args.source = s;
    } else if (a.startsWith('--sample-query=')) {
      args.sampleQuery = a.slice('--sample-query='.length);
    } else if (a.startsWith('--sample-k=')) {
      args.sampleK = Number(a.slice('--sample-k='.length));
    } else if (a.startsWith('--limit=')) {
      args.limit = Number(a.slice('--limit='.length));
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(
    [
      'Usage: pnpm tsx src/scripts/embed-sot.ts [opts]',
      '',
      '  --source=<all|guides|docs>     Which source to embed (default: all)',
      '  --force                        Re-embed even if hash matches',
      '  --dry-run                      Print plan, no upserts',
      '  --limit=N                      Cap articles per source (debugging)',
      '  --sample-query="..."           After embedding, run a retrieval query',
      '  --sample-k=N                   How many results to print (default 5)',
    ].join('\n'),
  );
}

async function* iterateSource(source: SotSource): AsyncGenerator<Article> {
  if (source === 'guides') yield* crawlGuides();
  else if (source === 'docs') yield* crawlDocs();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sources: SotSource[] = args.source === 'all' ? SOT_SOURCES : [args.source];

  const stats = { total: 0, upserted: 0, skipped: 0, articlesSeen: 0 };
  const redis = kv();
  const v = args.dryRun ? null : vec();

  console.log(
    `\nembed-sot · sources=[${sources.join(',')}]${args.force ? ' · FORCE' : ''}${
      args.dryRun ? ' · DRY-RUN' : ''
    }${args.limit ? ` · limit=${args.limit}` : ''}\n`,
  );

  const now = new Date().toISOString();

  for (const src of sources) {
    let count = 0;
    for await (const article of iterateSource(src)) {
      if (args.limit && count >= args.limit) break;
      const chunks = chunkArticle(article);
      stats.articlesSeen += 1;
      stats.total += chunks.length;

      const toUpsert: typeof chunks = [];
      for (const c of chunks) {
        const hashKey = `vec_hash:${c.id}`;
        const newSha = sha256(c.text);
        if (args.force) {
          toUpsert.push(c);
          continue;
        }
        const prev = await redis.get<string | null>(hashKey);
        if (prev !== newSha) {
          toUpsert.push(c);
        } else {
          stats.skipped += 1;
        }
      }

      if (toUpsert.length > 0 && v) {
        await upsertChunks(toUpsert, v);
        for (const c of toUpsert) {
          await redis.set(`vec_hash:${c.id}`, sha256(c.text));
        }
        stats.upserted += toUpsert.length;
      } else if (toUpsert.length > 0 && args.dryRun) {
        stats.upserted += toUpsert.length; // count what would have been upserted
      }

      console.log(
        `  ${src.padEnd(6)} · ${article.stableId.padEnd(40).slice(0, 40)} · chunks=${chunks.length} upsert=${toUpsert.length}`,
      );
      count += 1;
    }
  }

  console.log(
    `\nSummary: articles=${stats.articlesSeen} chunks_total=${stats.total} upserted=${stats.upserted} unchanged_skipped=${stats.skipped} · ${now}`,
  );

  if (args.sampleQuery && v) {
    console.log(`\nQuery: ${args.sampleQuery}\n`);
    const results = await retrieveTopK(args.sampleQuery, args.sampleK, {}, v);
    for (const r of results) {
      const src = r.metadata.source ?? '?';
      const heading = r.metadata.sectionHeading ?? '';
      const score = r.score.toFixed(3);
      console.log(`  ${score} · ${src.padEnd(6)} · ${r.id}`);
      console.log(`         heading: ${heading}`);
      console.log(`         preview: ${r.data.slice(0, 140).replace(/\n/g, ' ')}...\n`);
    }
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unusedDelete = deleteChunks; // kept for future cleanup workflows
