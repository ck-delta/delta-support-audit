import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { findCoverageGaps } from '@/lib/audit/coverage';
import type { CoverageIssue } from '@/lib/types';

loadEnv({ path: '.env.local' });

interface Args {
  limit?: number;
  threshold: number;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const today = new Date().toISOString().slice(0, 10);
  const args: Args = { threshold: 0.7, out: `docs/M5-coverage-${today}.json` };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length));
    else if (a.startsWith('--threshold=')) args.threshold = Number(a.slice('--threshold='.length));
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          'Usage: pnpm tsx src/scripts/m5-coverage.ts [opts]',
          '',
          '  --limit=N           Cap SoT chunks scanned (default: all)',
          '  --threshold=0.7     Similarity below which we ask LLM',
          '  --out=PATH          Output path',
        ].join('\n'),
      );
      process.exit(0);
    } else throw new Error(`Unknown arg: ${a}`);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const startedAt = new Date();
  const runTimestamp = startedAt.toISOString();

  console.log(
    `\nm5-coverage · threshold=${args.threshold}${args.limit ? ` · limit=${args.limit}` : ' · all SoT chunks'}\n`,
  );

  const gaps: CoverageIssue[] = [];
  let processed = 0;
  let lastTick = 0;
  for await (const g of findCoverageGaps({
    limit: args.limit,
    similarityThreshold: args.threshold,
    runTimestamp,
    onProgress: (msg) => {
      processed += 1;
      if (Date.now() - lastTick > 5000) {
        console.log(`  [${processed}] ${msg}`);
        lastTick = Date.now();
      }
    },
  })) {
    gaps.push(g);
    console.log(`  GAP #${gaps.length}: [${g.severity}] ${g.summary.slice(0, 100)}`);
  }

  const durationMs = Date.now() - startedAt.getTime();
  console.log(`\nCoverage complete in ${(durationMs / 1000).toFixed(0)}s`);
  console.log(`  SoT chunks processed: ${processed}`);
  console.log(`  Gaps found: ${gaps.length}`);
  console.log(`  By severity: P1=${gaps.filter((g) => g.severity === 'P1').length} P2=${gaps.filter((g) => g.severity === 'P2').length}`);

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify({ runTimestamp, durationMs, threshold: args.threshold, gaps }, null, 2), 'utf8');
  console.log(`\nReport written: ${args.out}`);

  // Triage markdown
  const triagePath = args.out.replace(/\.json$/, '-triage.md');
  const lines: string[] = [];
  lines.push('# M5 Coverage Triage');
  lines.push('');
  lines.push(`Generated: ${runTimestamp}`);
  lines.push(`SoT chunks scanned: ${processed} · Threshold: ${args.threshold} · Gaps: ${gaps.length}`);
  lines.push('');
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i]!;
    lines.push(`### Coverage-${i + 1} [${g.severity}]: ${g.summary}`);
    lines.push('');
    lines.push(`- **Verdict:** [ ] TP   [ ] FP   [ ] AMB`);
    lines.push(`- **Reason:** _____`);
    lines.push(`- Similarity: ${g.similarity.toFixed(2)} · Confidence: ${g.confidence.toFixed(2)} · Owner: ${g.suggestedOwner}`);
    lines.push(`- SoT (${g.sotSource}): ${g.sotUrl}`);
    lines.push(`- Suggested topic: ${g.suggestedSupportTopic}`);
    lines.push(`- Missing aspects: ${g.missingAspects.join(', ') || '-'}`);
    lines.push('');
  }
  writeFileSync(triagePath, lines.join('\n') + '\n', 'utf8');
  console.log(`Triage checklist: ${triagePath}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
