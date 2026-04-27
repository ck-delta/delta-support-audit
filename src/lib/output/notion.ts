import { Client } from '@notionhq/client';
import type {
  AuditReport,
  ConflictIssue,
  CoverageIssue,
  Issue,
  Severity,
} from '@/lib/types';

let client: Client | null = null;

export function notion(): Client {
  if (client) return client;
  const auth = process.env.NOTION_API_KEY;
  if (!auth) throw new Error('NOTION_API_KEY is not set');
  client = new Client({ auth });
  return client;
}

export function resetNotionForTests(): void {
  client = null;
}

export interface UpsertOptions {
  pageId?: string;
  client?: Client;
}

export async function upsertAuditPage(report: AuditReport, opts: UpsertOptions = {}): Promise<void> {
  const pageId = opts.pageId ?? process.env.NOTION_AUDIT_PAGE_ID;
  if (!pageId) throw new Error('NOTION_AUDIT_PAGE_ID is not set');
  const c = opts.client ?? notion();
  await deleteAllChildren(c, pageId);
  const blocks = buildBlocks(report);
  // Notion API caps at 100 children per append call
  for (let i = 0; i < blocks.length; i += 100) {
    await c.blocks.children.append({
      block_id: pageId,
      children: blocks.slice(i, i + 100) as Parameters<typeof c.blocks.children.append>[0]['children'],
    });
  }
}

async function deleteAllChildren(c: Client, pageId: string): Promise<void> {
  while (true) {
    const list = await c.blocks.children.list({ block_id: pageId, page_size: 100 });
    if (list.results.length === 0) break;
    for (const block of list.results) {
      if ('id' in block) await c.blocks.delete({ block_id: block.id });
    }
    if (!list.has_more) break;
  }
}

type Block = Record<string, unknown>;

export function buildBlocks(report: AuditReport): Block[] {
  const m = report.metadata;
  const totals = {
    P0: report.issuesBySeverity.P0.length,
    P1: report.issuesBySeverity.P1.length,
    P2: report.issuesBySeverity.P2.length,
  };

  const blocks: Block[] = [];
  blocks.push(h1('Delta Support Audit — Latest Run'));
  blocks.push(
    callout(
      [
        `Run completed: ${m.completedAt}`,
        `Articles audited: ${m.articlesAudited} (changed: ${m.articlesChanged} of ${m.articlesChecked})`,
        `New issues: ${m.newIssues} · Still-open: ${m.stillOpenIssues} · Resolved: ${m.resolvedIssues}`,
        m.truncated ? `⚠ Truncated (timed out)` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    ),
  );

  blocks.push(h2('Summary'));
  blocks.push(
    paragraph(
      `Issues by severity — P0: **${totals.P0}** · P1: **${totals.P1}** · P2: **${totals.P2}** · Conflicts: **${report.conflicts.length}** · Coverage gaps: **${report.coverageGaps.length}**`,
    ),
  );

  pushSeveritySection(blocks, 'P0', report.issuesBySeverity.P0);
  pushSeveritySection(blocks, 'P1', report.issuesBySeverity.P1);
  pushSeveritySection(blocks, 'P2', report.issuesBySeverity.P2);

  blocks.push(h2('Source-of-Truth Conflicts (guides ↔ docs)'));
  if (report.conflicts.length === 0) blocks.push(paragraph('(none)'));
  else for (const c of report.conflicts) blocks.push(toggleConflict(c));

  blocks.push(h2('Coverage Gaps'));
  if (report.coverageGaps.length === 0) blocks.push(paragraph('(none)'));
  else for (const g of report.coverageGaps) blocks.push(toggleCoverage(g));

  blocks.push(h2('Run Metadata'));
  blocks.push(
    paragraph(
      [
        `Model: ${m.model}`,
        `Duration: ${(m.durationMs / 1000).toFixed(1)}s`,
        `Tokens: prompt=${m.promptTokens} completion=${m.completionTokens} total=${m.promptTokens + m.completionTokens}`,
        `Cost (est): $${m.costEstimateUsd.toFixed(4)}`,
        `Errors: ${m.errors}`,
      ].join(' · '),
    ),
  );

  return blocks;
}

function pushSeveritySection(blocks: Block[], severity: Severity, issues: Issue[]): void {
  blocks.push(h2(`${severity} Issues`));
  if (issues.length === 0) blocks.push(paragraph('(none)'));
  else for (const i of issues) blocks.push(toggleIssue(i));
}

function toggleIssue(issue: Issue): Block {
  const title = `[${issue.severity}] [${issue.status}] ${truncate(issue.summary, 180)}`;
  const lines: string[] = [];
  if (issue.supportUrl) lines.push(`Support: ${issue.supportUrl}`);
  if (issue.sotUrl) lines.push(`SoT: ${issue.sotUrl}`);
  if (issue.supportQuote) lines.push(`Support quote: "${truncate(issue.supportQuote, 220)}"`);
  if (issue.sotQuote) lines.push(`SoT quote: "${truncate(issue.sotQuote, 220)}"`);
  lines.push(`Confidence: ${issue.confidence.toFixed(2)}`);
  if (issue.suggestedOwner) lines.push(`Suggested owner: ${issue.suggestedOwner}`);
  lines.push(`First seen: ${issue.firstSeenAt}`);
  lines.push(`Last seen: ${issue.lastSeenAt}`);
  return toggle(title, lines.map((l) => paragraph(l)));
}

function toggleConflict(c: ConflictIssue): Block {
  const title = `[${c.severity}] ${truncate(c.summary, 180)}`;
  const lines = [
    `Guides: ${c.guidesUrl}`,
    `Guides quote: "${truncate(c.guidesQuote, 220)}"`,
    `Docs: ${c.docsUrl}`,
    `Docs quote: "${truncate(c.docsQuote, 220)}"`,
    `Confidence: ${c.confidence.toFixed(2)}`,
    `First seen: ${c.firstSeenAt} · Last seen: ${c.lastSeenAt}`,
  ];
  return toggle(title, lines.map((l) => paragraph(l)));
}

function toggleCoverage(g: CoverageIssue): Block {
  const title = `[${g.severity}] ${truncate(g.summary, 180)}`;
  const lines = [
    `SoT (${g.sotSource}): ${g.sotUrl}`,
    `Closest support match similarity: ${g.similarity.toFixed(2)}`,
    `Suggested support topic: ${g.suggestedSupportTopic}`,
    `Missing aspects: ${g.missingAspects.join(', ') || '-'}`,
    `Suggested owner: ${g.suggestedOwner}`,
    `Confidence: ${g.confidence.toFixed(2)}`,
  ];
  return toggle(title, lines.map((l) => paragraph(l)));
}

function h1(text: string): Block {
  return {
    object: 'block',
    type: 'heading_1',
    heading_1: { rich_text: [{ type: 'text', text: { content: text } }] },
  };
}

function h2(text: string): Block {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ type: 'text', text: { content: text } }] },
  };
}

function paragraph(text: string): Block {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: chunkRichText(text) },
  };
}

function callout(text: string): Block {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: chunkRichText(text),
      icon: { type: 'emoji', emoji: '📋' },
    },
  };
}

function toggle(title: string, children: Block[]): Block {
  return {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: chunkRichText(title),
      children,
    },
  };
}

function chunkRichText(text: string): Array<{ type: 'text'; text: { content: string } }> {
  // Notion has a 2000-char limit per rich-text content segment
  const out: Array<{ type: 'text'; text: { content: string } }> = [];
  for (let i = 0; i < text.length; i += 1900) {
    out.push({ type: 'text', text: { content: text.slice(i, i + 1900) } });
  }
  return out;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
