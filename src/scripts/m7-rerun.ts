// M7 re-run: full audit on the India support corpus + publish to Google Sheets only.
// Slack + Notion are intentionally skipped — production is paused; this is a
// one-shot local re-run after guide updates. Use this whenever you want a
// fresh sweep without notifying channels.

import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runAudit } from '@/lib/audit/orchestrator';
import { publishToSheet } from '@/lib/output/sheets';

loadEnv({ path: '.env.local' });

const today = new Date().toISOString().slice(0, 10);
const outPath = `docs/M7-final-${today}.json`;

console.log(`\nm7-rerun · WRITE · force=true · all India-visible articles`);
console.log(`Pushing to Sheets only (Slack + Notion skipped during pause).`);
console.log(`Cost estimate: ~$5-7. Time: ~10-15 min.\n`);

const startedAt = new Date();
const { report } = await runAudit({
  dryRun: false,
  force: true,
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

console.log(`\nUpserting to Google Sheets (New Issues + All Issues + per-severity tabs)...`);
const result = await publishToSheet(report);
console.log(`  ${result.url}`);

console.log(`\n✓ M7 re-run complete.`);
console.log(`  Slack and Notion intentionally NOT touched (system is paused).`);
console.log(`  Run dashboard rebuild before deploy: pnpm build-dashboard-data`);
