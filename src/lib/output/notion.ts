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

  // Callout: rich text with bolded labels
  const completedDate = m.completedAt.split('T')[0] ?? m.completedAt;
  const completedTime = (m.completedAt.split('T')[1] ?? '').slice(0, 8);
  blocks.push(
    calloutRich([
      bold('Run completed: '),
      text(`${completedDate} ${completedTime} UTC`),
      text('  ·  '),
      bold('Articles audited: '),
      text(`${m.articlesAudited}`),
      text(` (${m.articlesChanged} changed of ${m.articlesChecked})`),
      text('  ·  '),
      bold('New issues: '),
      text(`${m.newIssues}`),
      text(`  ·  `),
      bold('Still-open: '),
      text(`${m.stillOpenIssues}`),
      text(`  ·  `),
      bold('Resolved: '),
      text(`${m.resolvedIssues}`),
      ...(m.truncated ? [text('  ·  '), bold('⚠ Truncated (timed out)')] : []),
    ]),
  );

  blocks.push(h2('Summary'));
  blocks.push(
    paragraphRich([
      text('Issues by severity — '),
      bold(`🚨 P0: ${totals.P0}`),
      text('  ·  '),
      bold(`⚠️ P1: ${totals.P1}`),
      text('  ·  '),
      bold(`📝 P2: ${totals.P2}`),
      text('  ·  '),
      bold(`🔀 Conflicts: ${report.conflicts.length}`),
      text('  ·  '),
      bold(`🕳️ Coverage gaps: ${report.coverageGaps.length}`),
    ]),
  );

  pushSeveritySection(blocks, 'P0', report.issuesBySeverity.P0);
  pushSeveritySection(blocks, 'P1', report.issuesBySeverity.P1);
  pushSeveritySection(blocks, 'P2', report.issuesBySeverity.P2);

  blocks.push(h2(`🔀 Source-of-Truth Conflicts (${report.conflicts.length})`));
  if (report.conflicts.length === 0) blocks.push(paragraph('(none)'));
  else for (const c of report.conflicts) blocks.push(toggleConflict(c));

  blocks.push(h2(`🕳️ Coverage Gaps (${report.coverageGaps.length})`));
  if (report.coverageGaps.length === 0) blocks.push(paragraph('(none)'));
  else for (const g of report.coverageGaps) blocks.push(toggleCoverage(g));

  blocks.push(h2('Run Metadata'));
  blocks.push(
    paragraphRich([
      bold('Model: '),
      text(m.model),
      text('  ·  '),
      bold('Duration: '),
      text(`${(m.durationMs / 1000).toFixed(1)}s`),
      text('  ·  '),
      bold('Tokens: '),
      text(`${m.promptTokens + m.completionTokens} (${m.promptTokens} in / ${m.completionTokens} out)`),
      text('  ·  '),
      bold('Cost (est): '),
      text(`$${m.costEstimateUsd.toFixed(4)}`),
      text('  ·  '),
      bold('Errors: '),
      text(`${m.errors}`),
    ]),
  );

  return blocks;
}

function calloutRich(parts: RichText[]): Block {
  return {
    object: 'block',
    type: 'callout',
    callout: { rich_text: parts, icon: { type: 'emoji', emoji: '📋' } },
  };
}

function pushSeveritySection(blocks: Block[], severity: Severity, issues: Issue[]): void {
  blocks.push(h2(`${severityEmoji(severity)} ${severity} Issues (${issues.length})`));
  if (issues.length === 0) {
    blocks.push(paragraph('(none)'));
    return;
  }
  for (const i of issues) blocks.push(toggleIssue(i));
}

function severityEmoji(s: Severity): string {
  return s === 'P0' ? '🚨' : s === 'P1' ? '⚠️' : '📝';
}

function ownerEmoji(o?: string): string {
  if (o === 'Support') return '👨‍💼';
  if (o === 'Docs') return '📚';
  if (o === 'Engineering') return '⚙️';
  if (o === 'Product') return '💼';
  return '❓';
}

function toggleIssue(issue: Issue): Block {
  // Compact title: emoji + bold severity + owner + summary
  const titleRichText: RichText[] = [
    text(`${severityEmoji(issue.severity)} `),
    bold(issue.severity),
    text(` · ${ownerEmoji(issue.suggestedOwner)} ${issue.suggestedOwner ?? 'Unassigned'} · `),
    text(truncate(issue.summary, 180)),
  ];

  const children: Block[] = [];

  // Article links
  if (issue.supportUrl) {
    children.push(paragraphRich([bold('Support article: '), link('Open in Freshdesk →', issue.supportUrl)]));
  }
  if (issue.sotUrl) {
    children.push(paragraphRich([bold('Source of truth: '), link('Open SoT →', issue.sotUrl)]));
  }

  // Quotes (as quote blocks for visual distinction)
  if (issue.supportQuote) {
    children.push(quoteBlock([bold('Support says: '), text(`"${truncate(issue.supportQuote, 240)}"`)]));
  }
  if (issue.sotQuote) {
    children.push(quoteBlock([bold('SoT says: '), text(`"${truncate(issue.sotQuote, 240)}"`)]));
  }

  // Metadata
  const metaParts: RichText[] = [
    bold('Confidence: '),
    text(`${issue.confidence.toFixed(2)}`),
    text(' · '),
    bold('Status: '),
    text(issue.status),
    text(' · '),
    bold('First seen: '),
    text(issue.firstSeenAt.split('T')[0] ?? issue.firstSeenAt),
  ];
  children.push(paragraphRich(metaParts));

  return toggleRich(titleRichText, children);
}

function toggleConflict(c: ConflictIssue): Block {
  const titleRichText: RichText[] = [
    text(`🔀 `),
    bold(c.severity),
    text(' · Conflict (guides ↔ docs) · '),
    text(truncate(c.summary, 180)),
  ];

  const children: Block[] = [
    paragraphRich([bold('Guides: '), link('Open guides chunk →', c.guidesUrl)]),
    quoteBlock([bold('Guides says: '), text(`"${truncate(c.guidesQuote, 240)}"`)]),
    paragraphRich([bold('Docs: '), link('Open docs chunk →', c.docsUrl)]),
    quoteBlock([bold('Docs says: '), text(`"${truncate(c.docsQuote, 240)}"`)]),
    paragraphRich([
      bold('Confidence: '),
      text(`${c.confidence.toFixed(2)}`),
      text(' · '),
      bold('First seen: '),
      text(c.firstSeenAt.split('T')[0] ?? c.firstSeenAt),
    ]),
  ];
  return toggleRich(titleRichText, children);
}

function toggleCoverage(g: CoverageIssue): Block {
  const titleRichText: RichText[] = [
    text(`🕳️ `),
    bold(g.severity),
    text(` · ${ownerEmoji(g.suggestedOwner)} ${g.suggestedOwner} · `),
    text(truncate(g.summary, 180)),
  ];

  const children: Block[] = [
    paragraphRich([bold(`SoT (${g.sotSource}): `), link('Open SoT →', g.sotUrl)]),
    paragraphRich([bold('Closest support match similarity: '), text(g.similarity.toFixed(2))]),
    paragraphRich([bold('Suggested support topic: '), text(g.suggestedSupportTopic || '—')]),
    paragraphRich([bold('Missing aspects: '), text(g.missingAspects.join(', ') || '—')]),
    paragraphRich([bold('Confidence: '), text(g.confidence.toFixed(2))]),
  ];
  return toggleRich(titleRichText, children);
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

// Rich-text helpers for bold + links

interface RichText {
  type: 'text';
  text: { content: string; link?: { url: string } };
  annotations?: { bold?: boolean; italic?: boolean; code?: boolean; color?: string };
}

function text(content: string): RichText {
  return { type: 'text', text: { content } };
}

function bold(content: string): RichText {
  return { type: 'text', text: { content }, annotations: { bold: true } };
}

function link(label: string, url: string): RichText {
  return { type: 'text', text: { content: label, link: { url } } };
}

function paragraphRich(parts: RichText[]): Block {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: parts },
  };
}

function quoteBlock(parts: RichText[]): Block {
  return {
    object: 'block',
    type: 'quote',
    quote: { rich_text: parts },
  };
}

function toggleRich(titleParts: RichText[], children: Block[]): Block {
  return {
    object: 'block',
    type: 'toggle',
    toggle: { rich_text: titleParts, children },
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
