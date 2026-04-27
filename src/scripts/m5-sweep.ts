import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runAudit } from '@/lib/audit/orchestrator';
import type { AuditReport, ConflictIssue, CoverageIssue, Issue } from '@/lib/types';

loadEnv({ path: '.env.local' });

interface Args {
  coverage: boolean;
  limit?: number;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    coverage: false,
    out: `docs/M5-first-sweep-${todayStamp()}.json`,
  };
  for (const a of argv.slice(2)) {
    if (a === '--coverage') args.coverage = true;
    else if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length));
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          'Usage: pnpm tsx src/scripts/m5-sweep.ts [opts]',
          '',
          '  --coverage         Also run coverage detector',
          '  --limit=N          Cap support articles audited',
          '  --out=PATH         JSON output path (default: docs/M5-first-sweep-<date>.json)',
        ].join('\n'),
      );
      process.exit(0);
    } else throw new Error(`Unknown arg: ${a}`);
  }
  return args;
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  console.log(
    `\nm5-sweep · DRY-RUN (no Slack/Notion) · force=true${args.coverage ? ' · +coverage' : ''}${
      args.limit ? ` · limit=${args.limit}` : ''
    }\n`,
  );
  console.log('This audits ALL changed articles (force=true bypasses hash check).');
  console.log('Estimated cost: ~$0.027 per article. ~$8-10 for full 313-article sweep.\n');

  const startedAt = new Date();
  const { report } = await runAudit({
    dryRun: true,
    force: true,
    limit: args.limit,
    coverage: args.coverage,
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
  console.log(
    `  tokens prompt=${report.metadata.promptTokens} completion=${report.metadata.completionTokens}`,
  );
  console.log(`  cost (estimated): $${report.metadata.costEstimateUsd.toFixed(4)}`);

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nReport written: ${args.out}`);

  // Also emit a triage markdown next to the JSON
  const triagePath = args.out.replace(/\.json$/, '-triage.md');
  writeFileSync(triagePath, renderTriageMarkdown(report), 'utf8');
  console.log(`Triage checklist: ${triagePath}`);
}

function renderTriageMarkdown(report: AuditReport): string {
  const m = report.metadata;
  const lines: string[] = [];
  lines.push('# M5 Triage Checklist');
  lines.push('');
  lines.push(`Generated: ${m.completedAt}`);
  lines.push(
    `Articles audited: ${m.articlesAudited} of ${m.articlesChecked} (${m.articlesChanged} changed)`,
  );
  lines.push(
    `Cost: $${m.costEstimateUsd.toFixed(4)} · prompt=${m.promptTokens} completion=${m.completionTokens}`,
  );
  lines.push('');
  lines.push('**Mark each finding** as TP (true positive), FP (false positive), or AMB (ambiguous).');
  lines.push('Add a one-line reason.');
  lines.push('');

  pushSection(lines, 'P0 Issues', report.issuesBySeverity.P0);
  pushSection(lines, 'P1 Issues', report.issuesBySeverity.P1);
  pushSection(lines, 'P2 Issues', report.issuesBySeverity.P2);
  pushConflicts(lines, report.conflicts);
  pushCoverage(lines, report.coverageGaps);

  lines.push('## Triage tally');
  lines.push('');
  lines.push('| Severity | Total | TP | FP | AMB | FP rate |');
  lines.push('|---|---|---|---|---|---|');
  lines.push(`| P0 | ${report.issuesBySeverity.P0.length} | _ | _ | _ | _% |`);
  lines.push(`| P1 | ${report.issuesBySeverity.P1.length} | _ | _ | _ | _% |`);
  lines.push(`| P2 | ${report.issuesBySeverity.P2.length} | _ | _ | _ | _% |`);
  lines.push(`| Conflicts | ${report.conflicts.length} | _ | _ | _ | _% |`);
  lines.push(`| Coverage | ${report.coverageGaps.length} | _ | _ | _ | _% |`);

  return lines.join('\n') + '\n';
}

function pushSection(out: string[], title: string, issues: Issue[]): void {
  out.push(`## ${title} (${issues.length})`);
  out.push('');
  if (issues.length === 0) {
    out.push('_(none)_');
    out.push('');
    return;
  }
  for (let i = 0; i < issues.length; i++) {
    const x = issues[i]!;
    out.push(`### ${title.replace(/ Issues$/, '')}-${i + 1}: ${trunc(x.summary, 100)}`);
    out.push('');
    out.push(`- **Verdict:** [ ] TP   [ ] FP   [ ] AMB`);
    out.push(`- **Reason:** _____`);
    out.push(`- Severity: ${x.severity} · Confidence: ${x.confidence.toFixed(2)} · Owner: ${x.suggestedOwner ?? '-'}`);
    if (x.supportUrl) out.push(`- Support: ${x.supportUrl}`);
    if (x.sotUrl) out.push(`- SoT: ${x.sotUrl}`);
    if (x.supportQuote) out.push(`- Support quote: \`${trunc(x.supportQuote, 220)}\``);
    if (x.sotQuote) out.push(`- SoT quote: \`${trunc(x.sotQuote, 220)}\``);
    out.push('');
  }
}

function pushConflicts(out: string[], conflicts: ConflictIssue[]): void {
  out.push(`## Conflicts (${conflicts.length})`);
  out.push('');
  if (conflicts.length === 0) {
    out.push('_(none)_');
    out.push('');
    return;
  }
  for (let i = 0; i < conflicts.length; i++) {
    const c = conflicts[i]!;
    out.push(`### Conflict-${i + 1}: ${trunc(c.summary, 100)}`);
    out.push('');
    out.push(`- **Verdict:** [ ] TP   [ ] FP   [ ] AMB`);
    out.push(`- **Reason:** _____`);
    out.push(`- Severity: ${c.severity} · Confidence: ${c.confidence.toFixed(2)}`);
    out.push(`- Guides: ${c.guidesUrl}`);
    out.push(`- Guides quote: \`${trunc(c.guidesQuote, 220)}\``);
    out.push(`- Docs: ${c.docsUrl}`);
    out.push(`- Docs quote: \`${trunc(c.docsQuote, 220)}\``);
    out.push('');
  }
}

function pushCoverage(out: string[], gaps: CoverageIssue[]): void {
  out.push(`## Coverage Gaps (${gaps.length})`);
  out.push('');
  if (gaps.length === 0) {
    out.push('_(none — coverage not run, or 0 gaps detected)_');
    out.push('');
    return;
  }
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i]!;
    out.push(`### Coverage-${i + 1}: ${trunc(g.summary, 100)}`);
    out.push('');
    out.push(`- **Verdict:** [ ] TP   [ ] FP   [ ] AMB`);
    out.push(`- **Reason:** _____`);
    out.push(
      `- Severity: ${g.severity} · Confidence: ${g.confidence.toFixed(2)} · Similarity: ${g.similarity.toFixed(2)}`,
    );
    out.push(`- SoT (${g.sotSource}): ${g.sotUrl}`);
    out.push(`- Suggested topic: ${g.suggestedSupportTopic}`);
    out.push(`- Missing aspects: ${g.missingAspects.join(', ') || '-'}`);
    out.push('');
  }
}

function trunc(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
