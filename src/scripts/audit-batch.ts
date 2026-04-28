import { config as loadEnv } from 'dotenv';
import { auditArticle } from '@/lib/audit/compare';
import { markIssues } from '@/lib/audit/dedupe';
import { findCoverageGaps } from '@/lib/audit/coverage';
import { crawl as crawlSupportFreshdesk } from '@/lib/crawl/support';
import type { Article, Issue, ConflictIssue, CoverageIssue } from '@/lib/types';

loadEnv({ path: '.env.local' });

interface Args {
  limit?: number;
  write: boolean;
  coverage: boolean;
  coverageLimit?: number;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    write: false,
    coverage: false,
    concurrency: Number(process.env.MAX_CONCURRENT_LLM_CALLS ?? 5),
  };
  for (const a of argv.slice(2)) {
    if (a === '--write') args.write = true;
    else if (a === '--coverage') args.coverage = true;
    else if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length));
    else if (a.startsWith('--coverage-limit=')) args.coverageLimit = Number(a.slice('--coverage-limit='.length));
    else if (a.startsWith('--concurrency=')) args.concurrency = Number(a.slice('--concurrency='.length));
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else throw new Error(`Unknown arg: ${a}`);
  }
  return args;
}

function printHelp(): void {
  console.log(
    [
      'Usage: pnpm tsx src/scripts/audit-batch.ts [opts]',
      '',
      '  --limit=N              Cap support articles audited (default: all)',
      '  --write                Persist Issue[] to Redis with dedup',
      '  --coverage             After audits, run coverage gap detector',
      '  --coverage-limit=N     Cap SoT chunks scanned for coverage',
      '  --concurrency=N        Parallel audit calls (default 5 from env)',
    ].join('\n'),
  );
}

interface RunStats {
  articlesAudited: number;
  totalIssues: number;
  newIssues: number;
  stillOpen: number;
  resolved: number;
  totalConflicts: number;
  coverageGaps: number;
  promptTokens: number;
  completionTokens: number;
  errors: number;
  byCategory: { P0: number; P1: number; P2: number };
}

async function runWithConcurrency<T, R>(
  items: AsyncIterable<T>,
  worker: (item: T) => Promise<R>,
  concurrency: number,
  onResult: (result: R, item: T) => void,
): Promise<void> {
  const queue: Array<{ item: T; promise: Promise<R> }> = [];
  for await (const item of items) {
    const promise = worker(item);
    queue.push({ item, promise });
    if (queue.length >= concurrency) {
      const done = queue.shift()!;
      try {
        const r = await done.promise;
        onResult(r, done.item);
      } catch {
        // worker handles its own errors; we just continue
      }
    }
  }
  // drain
  for (const q of queue) {
    try {
      const r = await q.promise;
      onResult(r, q.item);
    } catch {
      // continue
    }
  }
}

async function* limitedSupportArticles(limit?: number): AsyncGenerator<Article> {
  let n = 0;
  for await (const a of crawlSupportFreshdesk()) {
    if (limit && n >= limit) break;
    yield a;
    n += 1;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const runTimestamp = new Date().toISOString();
  const stats: RunStats = {
    articlesAudited: 0,
    totalIssues: 0,
    newIssues: 0,
    stillOpen: 0,
    resolved: 0,
    totalConflicts: 0,
    coverageGaps: 0,
    promptTokens: 0,
    completionTokens: 0,
    errors: 0,
    byCategory: { P0: 0, P1: 0, P2: 0 },
  };

  console.log(
    `\naudit-batch · ${args.write ? 'WRITE' : 'dry-run'}${args.coverage ? ' · +coverage' : ''} · concurrency=${args.concurrency}${
      args.limit ? ` · limit=${args.limit}` : ''
    }\n`,
  );

  const allConflicts: ConflictIssue[] = [];
  const allCoverageGaps: CoverageIssue[] = [];
  const dedupPromises: Promise<void>[] = [];

  await runWithConcurrency(
    limitedSupportArticles(args.limit),
    async (article: Article) => {
      const result = await auditArticle(article, { runTimestamp });
      return { article, result };
    },
    args.concurrency,
    ({ article, result }) => {
      stats.articlesAudited += 1;
      stats.promptTokens += result.promptTokens;
      stats.completionTokens += result.completionTokens;
      if (result.errored) {
        stats.errors += 1;
        console.log(`  ✗ ${article.stableId} · ${article.title.slice(0, 50)} · ERROR: ${result.errored}`);
        return;
      }
      stats.totalIssues += result.issues.length;
      stats.totalConflicts += result.conflicts.length;
      allConflicts.push(...result.conflicts);
      for (const i of result.issues) stats.byCategory[i.severity] += 1;

      if (args.write && result.issues.length > 0) {
        const p = markIssues(article.url, result.issues, runTimestamp)
          .then(({ counts }) => {
            stats.newIssues += counts.new;
            stats.stillOpen += counts.stillOpen;
            stats.resolved += counts.resolved;
          })
          .catch((e: unknown) => {
            console.error(`  dedup error for ${article.url}: ${(e as Error).message}`);
          });
        dedupPromises.push(p);
      }

      const issuesStr = result.issues.length === 0 ? '0' : `${result.issues.length} (${summarizeSeverities(result.issues)})`;
      const conflictStr = result.conflicts.length > 0 ? ` +${result.conflicts.length}c` : '';
      console.log(
        `  · ${article.stableId.padEnd(11)} · issues=${issuesStr}${conflictStr} · ${article.title.slice(0, 60)}`,
      );
    },
  );

  await Promise.all(dedupPromises);

  if (args.coverage) {
    console.log('\n--- coverage sweep ---\n');
    let n = 0;
    for await (const gap of findCoverageGaps({
      limit: args.coverageLimit,
      runTimestamp,
      onProgress: (msg) => console.log(`  ${msg}`),
    })) {
      n += 1;
      stats.coverageGaps += 1;
      allCoverageGaps.push(gap);
      console.log(`  GAP #${n}: [${gap.severity}] ${gap.summary} (${gap.sotUrl})`);
    }
  }

  console.log('\n========== Summary ==========');
  console.log(`Articles audited: ${stats.articlesAudited}`);
  console.log(`Errors:           ${stats.errors}`);
  console.log(`Issues found:     ${stats.totalIssues} (P0=${stats.byCategory.P0} P1=${stats.byCategory.P1} P2=${stats.byCategory.P2})`);
  console.log(`Conflicts:        ${stats.totalConflicts}`);
  if (args.coverage) console.log(`Coverage gaps:    ${stats.coverageGaps}`);
  if (args.write) {
    console.log(`Dedup:            new=${stats.newIssues} still-open=${stats.stillOpen} resolved=${stats.resolved}`);
  }
  const total = stats.promptTokens + stats.completionTokens;
  const costEst = (stats.promptTokens / 1_000_000) * 3 + (stats.completionTokens / 1_000_000) * 15;
  console.log(`Tokens:           prompt=${stats.promptTokens} completion=${stats.completionTokens} total=${total}`);
  console.log(`Cost estimate:    $${costEst.toFixed(4)} (Sonnet 4.6 list price)`);
}

function summarizeSeverities(issues: Issue[]): string {
  const counts = { P0: 0, P1: 0, P2: 0 };
  for (const i of issues) counts[i.severity] += 1;
  return `P0=${counts.P0} P1=${counts.P1} P2=${counts.P2}`;
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
