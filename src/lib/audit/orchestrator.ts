import { kv } from '@/lib/store/kv';
import { sha256, hashKey, diff, loadHash, storeHash } from '@/lib/store/hash';
import { auditArticle } from './compare';
import { markIssues } from './dedupe';
import { findCoverageGaps } from './coverage';
import { crawl as crawlSupport } from '@/lib/crawl/support';
import { buildReport, estimateCostUsd } from '@/lib/output/report';
import { runPool } from '@/lib/util/pool';
import type { Article, AuditReport, ConflictIssue, CoverageIssue, Issue, RunMetadata } from '@/lib/types';
import type { ArticleAuditOutcome } from '@/lib/output/report';

export interface OrchestratorOptions {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  coverage?: boolean;
  coverageLimit?: number;
  softTimeoutMs?: number;
  concurrency?: number;
  runTimestamp?: string;
}

export interface OrchestratorResult {
  report: AuditReport;
  newP0Count: number;
}

export async function runAudit(opts: OrchestratorOptions = {}): Promise<OrchestratorResult> {
  const startedAt = new Date();
  const startMs = startedAt.getTime();
  const runTimestamp = opts.runTimestamp ?? startedAt.toISOString();
  const softTimeoutMs = opts.softTimeoutMs ?? 50_000;
  const concurrency = opts.concurrency ?? Number(process.env.MAX_CONCURRENT_LLM_CALLS ?? 5);
  const force = opts.force ?? false;
  const dryRun = opts.dryRun ?? false;
  const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6';

  const redis = kv();
  let articlesChecked = 0;
  let articlesChanged = 0;
  let articlesAudited = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let errors = 0;
  let truncated = false;
  const allOutcomes: ArticleAuditOutcome[] = [];
  const dedupCounts = { new: 0, stillOpen: 0, resolved: 0 };

  async function* changedArticles(): AsyncGenerator<Article> {
    for await (const article of crawlSupport()) {
      articlesChecked += 1;
      if (opts.limit && articlesChecked > opts.limit) return;
      if (Date.now() - startMs > softTimeoutMs) {
        truncated = true;
        return;
      }
      let isChanged = true;
      if (!force) {
        const sha = sha256(article.text);
        const key = hashKey(article.source, article.stableId);
        const prev = await loadHash(redis, key);
        const d = diff(prev, sha, runTimestamp);
        isChanged = d.changed;
        if (!dryRun) await storeHash(redis, key, d.next);
      }
      if (!isChanged) continue;
      articlesChanged += 1;
      yield article;
    }
  }

  const poolResult = await runPool(
    changedArticles(),
    async (article: Article) => {
      const result = await auditArticle(article, { runTimestamp });
      return { article, result };
    },
    async ({ article, result }) => {
      promptTokens += result.promptTokens;
      completionTokens += result.completionTokens;
      if (result.errored) {
        errors += 1;
        return;
      }
      articlesAudited += 1;
      let outcome: ArticleAuditOutcome = { issues: result.issues, conflicts: result.conflicts };
      if (!dryRun && result.issues.length > 0) {
        const dedup = await markIssues(article.url, result.issues, runTimestamp, redis);
        outcome = { issues: dedup.marked, conflicts: result.conflicts };
        dedupCounts.new += dedup.counts.new;
        dedupCounts.stillOpen += dedup.counts.stillOpen;
        dedupCounts.resolved += dedup.counts.resolved;
      }
      allOutcomes.push(outcome);
    },
    {
      concurrency,
      shouldStop: () => Date.now() - startMs > softTimeoutMs,
    },
  );
  if (poolResult.truncated) truncated = true;

  const coverageGaps: CoverageIssue[] = [];
  if (opts.coverage) {
    for await (const g of findCoverageGaps({
      limit: opts.coverageLimit,
      runTimestamp,
    })) {
      coverageGaps.push(g);
      if (Date.now() - startMs > softTimeoutMs) {
        truncated = true;
        break;
      }
    }
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;
  const totalIssues = allOutcomes.reduce((s, o) => s + o.issues.length, 0);
  const totalConflicts = countUniqueConflicts(allOutcomes.flatMap((o) => o.conflicts));

  const metadata: RunMetadata = {
    startedAt: startedAt.toISOString(),
    completedAt,
    model,
    articlesChecked,
    articlesChanged,
    articlesAudited,
    totalIssues,
    newIssues: dedupCounts.new,
    stillOpenIssues: dedupCounts.stillOpen,
    resolvedIssues: dedupCounts.resolved,
    totalConflicts,
    totalCoverageGaps: coverageGaps.length,
    promptTokens,
    completionTokens,
    costEstimateUsd: estimateCostUsd(promptTokens, completionTokens),
    truncated,
    durationMs,
    errors,
  };

  const report = buildReport({ articleResults: allOutcomes, coverageGaps, metadata });
  const newP0Count = report.issuesBySeverity.P0.filter((i) => i.status === 'new').length;
  return { report, newP0Count };
}

function countUniqueConflicts(conflicts: ConflictIssue[]): number {
  return new Set(conflicts.map((c) => c.id)).size;
}

// re-export so callers don't need to import from compare directly
export { auditArticle };
export type { Article, Issue, ConflictIssue, CoverageIssue };
