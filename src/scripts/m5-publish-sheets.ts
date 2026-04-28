import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { publishToSheet } from '@/lib/output/sheets';
import type { AuditReport } from '@/lib/types';

loadEnv({ path: '.env.local' });

const path = process.argv[2];
const shareWith = process.argv[3] ?? 'charandeep.kapoor@delta.exchange';
if (!path) {
  console.error(
    'Usage: pnpm tsx src/scripts/m5-publish-sheets.ts <path-to-report.json> [share-with-email]',
  );
  console.error('  Defaults: share with charandeep.kapoor@delta.exchange');
  console.error(
    '  Set GOOGLE_SHEET_ID in .env.local to write to an existing sheet; otherwise a new one is created.',
  );
  process.exit(1);
}

const report = JSON.parse(readFileSync(path, 'utf8')) as AuditReport;
const m = report.metadata;

console.log(`Loaded report: ${path}`);
console.log(
  `  P0=${report.issuesBySeverity.P0.length} P1=${report.issuesBySeverity.P1.length} P2=${report.issuesBySeverity.P2.length} conflicts=${report.conflicts.length}`,
);
console.log(`  Articles audited: ${m.articlesAudited} of ${m.articlesChecked}`);

const existingId = process.env.GOOGLE_SHEET_ID;
console.log(
  `\nPublishing to ${existingId ? `existing sheet ${existingId}` : 'a new spreadsheet'}...`,
);

const result = await publishToSheet(report, {
  shareWithEmail: shareWith,
  title: `Delta Support Audit — ${(m.completedAt.split('T')[0] ?? 'unknown')} (${m.articlesAudited} articles)`,
});

console.log(`\n✓ Published.`);
console.log(`  Spreadsheet: ${result.url}`);
if (result.created) {
  console.log(`  Created new spreadsheet, shared with ${shareWith}`);
  console.log(`  Tip: paste the ID below into .env.local as GOOGLE_SHEET_ID to update this same sheet next time:`);
  console.log(`  GOOGLE_SHEET_ID=${result.spreadsheetId}`);
} else {
  console.log(`  Updated existing spreadsheet (cleared previous data + rewrote).`);
}
