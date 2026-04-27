import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { postP0Summary } from '@/lib/output/slack';
import { upsertAuditPage } from '@/lib/output/notion';
import type { AuditReport } from '@/lib/types';

loadEnv({ path: '.env.local' });

const path = process.argv[2];
if (!path) {
  console.error('Usage: pnpm tsx src/scripts/m5-publish-curated.ts <path-to-report.json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path, 'utf8')) as AuditReport;

// High-signal cut: keep P0s + conflicts. Drop P1, P2, coverage gaps.
const curated: AuditReport = {
  metadata: {
    ...raw.metadata,
    // Reflect the curated counts
    totalIssues: raw.issuesBySeverity.P0.length,
    totalConflicts: raw.conflicts.length,
    totalCoverageGaps: 0,
  },
  issuesBySeverity: {
    P0: raw.issuesBySeverity.P0,
    P1: [],
    P2: [],
  },
  conflicts: raw.conflicts,
  coverageGaps: [],
};

// In a dry-run-sourced report all issues are status='new'. Treat all P0s as new for Slack.
const newP0Issues = curated.issuesBySeverity.P0;

console.log(`Loaded report: ${path}`);
console.log(
  `  Original: P0=${raw.issuesBySeverity.P0.length} P1=${raw.issuesBySeverity.P1.length} P2=${raw.issuesBySeverity.P2.length} conflicts=${raw.conflicts.length}`,
);
console.log(`  Curated:  P0=${curated.issuesBySeverity.P0.length} (P1, P2 dropped) conflicts=${curated.conflicts.length}`);

const notionPageUrl = process.env.NOTION_AUDIT_PAGE_ID
  ? `https://www.notion.so/${process.env.NOTION_AUDIT_PAGE_ID}`
  : undefined;

console.log('\nPosting to Slack...');
await postP0Summary({ newP0Issues, metadata: curated.metadata, notionPageUrl });
console.log(`  ${newP0Issues.length === 0 ? 'no P0s, skipped' : `posted ${newP0Issues.length} P0s`}`);

console.log('\nUpserting to Notion...');
await upsertAuditPage(curated);
console.log('  done');

console.log('\n✓ Curated publish complete.');
