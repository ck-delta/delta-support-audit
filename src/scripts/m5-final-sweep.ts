import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runAudit } from '@/lib/audit/orchestrator';
import { postP0Summary } from '@/lib/output/slack';
import { upsertAuditPage } from '@/lib/output/notion';
import type { AuditReport } from '@/lib/types';

loadEnv({ path: '.env.local' });

const today = new Date().toISOString().slice(0, 10);
const outPath = `docs/M5-final-${today}.json`;

console.log(`\nm5-final-sweep · WRITE · force=true · all 313 articles · publishing P0+conflicts`);
console.log(`Cost estimate: ~$8.50. Time: ~10–15 min.\n`);

const startedAt = new Date();
const { report } = await runAudit({
  dryRun: false, // persist hashes + issues to Redis
  force: true, // re-audit even if hashes match
  softTimeoutMs: Number.POSITIVE_INFINITY,
  runTimestamp: startedAt.toISOString(),
});

console.log(`\nSweep complete in ${(report.metadata.durationMs / 1000).toFixed(0)}s`);
console.log(
  `  articles checked=${report.metadata.articlesChecked} changed=${report.metadata.articlesChanged} audited=${report.metadata.articlesAudited} errors=${report.metadata.errors}`,
);
console.log(
  `  issues P0=${report.issuesBySeverity.P0.length} P1=${report.issuesBySeverity.P1.length} P2=${report.issuesBySeverity.P2.length}`,
);
console.log(`  conflicts=${report.conflicts.length} coverage_gaps=${report.coverageGaps.length}`);
console.log(`  cost (estimated): $${report.metadata.costEstimateUsd.toFixed(4)}`);
console.log(`  dedup: new=${report.metadata.newIssues} still-open=${report.metadata.stillOpenIssues} resolved=${report.metadata.resolvedIssues}`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`\nReport written: ${outPath}`);

// Filter to P0+conflicts only for the curated publish
const curated: AuditReport = {
  metadata: {
    ...report.metadata,
    totalIssues: report.issuesBySeverity.P0.length,
    totalConflicts: report.conflicts.length,
    totalCoverageGaps: 0,
  },
  issuesBySeverity: {
    P0: report.issuesBySeverity.P0,
    P1: [],
    P2: [],
  },
  conflicts: report.conflicts,
  coverageGaps: [],
};

// Slack: only NEW P0s (not still-open or resolved). The orchestrator already stamped status.
const newP0Issues = curated.issuesBySeverity.P0.filter((i) => i.status === 'new');

const notionPageUrl = process.env.NOTION_AUDIT_PAGE_ID
  ? `https://www.notion.so/${process.env.NOTION_AUDIT_PAGE_ID}`
  : undefined;

console.log(`\nPosting to Slack (${newP0Issues.length} new P0s)...`);
await postP0Summary({ newP0Issues, metadata: curated.metadata, notionPageUrl });
console.log(`  ${newP0Issues.length === 0 ? 'no new P0s, no message' : 'posted'}`);

console.log(`\nUpserting Notion (P0 + conflicts)...`);
await upsertAuditPage(curated);
console.log(`  done`);

console.log(`\n✓ M5 final sweep complete.`);
console.log(`  Redis seeded with ${report.metadata.articlesAudited} hashes + ${report.metadata.totalIssues} dedup entries.`);
console.log(`  Daily Vercel cron at 04:00 IST will only audit articles whose content drifts from this baseline.`);
