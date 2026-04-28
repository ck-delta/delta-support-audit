import { config as loadEnv } from 'dotenv';
import { auditArticle } from '@/lib/audit/compare';
import { markIssues } from '@/lib/audit/dedupe';
import { configFromEnv as fdConfig } from '@/lib/crawl/support';
import { fetchJson } from '@/lib/crawl/fetch';
import { normalize } from '@/lib/crawl/normalize';
import type { Article } from '@/lib/types';

loadEnv({ path: '.env.local' });

interface Args {
  target: string;
  noDedup: boolean;
  showPrompt: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { target: '', noDedup: false, showPrompt: false };
  const positional: string[] = [];
  for (const a of argv.slice(2)) {
    if (a === '--no-dedup') args.noDedup = true;
    else if (a === '--show-prompt') args.showPrompt = true;
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (a.startsWith('--')) {
      throw new Error(`Unknown flag: ${a}`);
    } else {
      positional.push(a);
    }
  }
  if (positional.length === 0) {
    printHelp();
    process.exit(1);
  }
  args.target = positional[0]!;
  return args;
}

function printHelp(): void {
  console.log(
    [
      'Usage: pnpm tsx src/scripts/audit-one.ts <article-id-or-url> [opts]',
      '',
      '  Argument can be:',
      '    - A Freshdesk article ID (e.g. 80001014604)',
      '    - A Freshdesk article URL (.../articles/80001014604[-slug])',
      '',
      '  Flags:',
      '    --no-dedup       Skip Redis dedup, just print fresh LLM output',
      '    --show-prompt    Print the rendered prompt before sending',
    ].join('\n'),
  );
}

function extractFreshdeskId(s: string): string | null {
  const m = s.match(/articles\/(\d+)/);
  if (m && m[1]) return m[1];
  if (/^\d+$/.test(s.trim())) return s.trim();
  return null;
}

interface FdArticle {
  id: number;
  title: string;
  description: string;
  status: number;
  updated_at: string;
}

async function fetchFreshdeskArticle(id: string): Promise<Article> {
  const cfg = fdConfig();
  const auth = `Basic ${Buffer.from(`${cfg.apiKey}:X`).toString('base64')}`;
  const a = await fetchJson<FdArticle>(`https://${cfg.domain}/api/v2/solutions/articles/${id}`, {
    headers: { Authorization: auth },
  });
  const html = a.description ?? '';
  const { text } = normalize(html, 'support');
  return {
    source: 'support',
    stableId: String(a.id),
    url: `https://${cfg.domain}/support/solutions/articles/${a.id}`,
    title: a.title,
    text,
    html,
    lastModified: a.updated_at,
  };
}

function printResult(article: Article, result: Awaited<ReturnType<typeof auditArticle>>): void {
  console.log('\n========== Audit Result ==========');
  console.log(`Article: ${article.title}`);
  console.log(`URL: ${article.url}`);
  console.log(`Body length: ${article.text.length} chars`);
  if (result.errored) console.log(`Errored: ${result.errored}`);
  console.log(
    `Tokens: prompt=${result.promptTokens} completion=${result.completionTokens} total=${result.promptTokens + result.completionTokens}`,
  );
  console.log(`\nIssues (${result.issues.length}):`);
  for (const i of result.issues) {
    console.log(`  [${i.severity}] (conf=${i.confidence.toFixed(2)} owner=${i.suggestedOwner ?? '-'}) ${i.summary}`);
    console.log(`    support: "${i.supportQuote?.slice(0, 120)}..."`);
    console.log(`    sot:     "${i.sotQuote?.slice(0, 120)}..." (${i.sotUrl})`);
  }
  console.log(`\nConflicts (${result.conflicts.length}):`);
  for (const c of result.conflicts) {
    console.log(`  [${c.severity}] (conf=${c.confidence.toFixed(2)}) ${c.summary}`);
    console.log(`    guides: "${c.guidesQuote.slice(0, 120)}..." (${c.guidesUrl})`);
    console.log(`    docs:   "${c.docsQuote.slice(0, 120)}..." (${c.docsUrl})`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const id = extractFreshdeskId(args.target);
  if (!id) {
    console.error('Could not extract a Freshdesk article ID from:', args.target);
    process.exit(1);
  }
  console.log(`Fetching Freshdesk article ${id}...`);
  const article = await fetchFreshdeskArticle(id);

  console.log(`Auditing... (compare prompt + Sonnet 4.6)`);
  const result = await auditArticle(article, { showPrompt: args.showPrompt });
  printResult(article, result);

  if (!args.noDedup) {
    const stamped = await markIssues(article.url, result.issues, new Date().toISOString());
    console.log(
      `\nDedup: new=${stamped.counts.new} still-open=${stamped.counts.stillOpen} resolved=${stamped.counts.resolved}`,
    );
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
