import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { postP0Summary } from '@/lib/output/slack';
import { upsertAuditPage } from '@/lib/output/notion';
import type { AuditReport } from '@/lib/types';

loadEnv({ path: '.env.local' });

const path = process.argv[2];
if (!path) {
  console.error('Usage: pnpm tsx src/scripts/publish-report.ts <path-to-report.json>');
  process.exit(1);
}

const report = JSON.parse(readFileSync(path, 'utf8')) as AuditReport;
console.log(`Loaded report: ${path}`);
console.log(
  `  P0=${report.issuesBySeverity.P0.length} P1=${report.issuesBySeverity.P1.length} P2=${report.issuesBySeverity.P2.length} conflicts=${report.conflicts.length} coverage=${report.coverageGaps.length}`,
);

const newP0Issues = report.issuesBySeverity.P0; // all are 'new' from a dryRun report

console.log('\nPosting to Slack...');
await postP0Summary({ newP0Issues, metadata: report.metadata });
console.log(`  ${newP0Issues.length === 0 ? 'no P0s, skipped' : 'posted'}`);

console.log('\nUpserting to Notion...');
await upsertAuditPage(report);
console.log('  done');
