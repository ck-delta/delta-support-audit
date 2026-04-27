import type { Issue, RunMetadata } from '@/lib/types';

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export interface SlackPostInput {
  newP0Issues: Issue[];
  metadata: RunMetadata;
  notionPageUrl?: string;
}

export async function postP0Summary(input: SlackPostInput): Promise<void> {
  if (input.newP0Issues.length === 0) return;
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error('SLACK_WEBHOOK_URL is not set');
  const payload = buildBlockKitPayload(input);
  await postWithRetry(url, payload);
}

function ownerEmoji(o?: string): string {
  if (o === 'Support') return '👨‍💼';
  if (o === 'Docs') return '📚';
  if (o === 'Engineering') return '⚙️';
  if (o === 'Product') return '💼';
  return '❓';
}

// Slack hard-limits to 50 blocks per message. Keep room for header + context +
// divider + (optional) "+N more" footer. With 1 section + 1 divider per issue,
// 18 issues = 36 blocks + ~4 fixed = 40. Cap at 18 to be safe.
const MAX_P0_BLOCKS_IN_MESSAGE = 18;

export function buildBlockKitPayload(input: SlackPostInput): Record<string, unknown> {
  const { newP0Issues, metadata, notionPageUrl } = input;

  // Sort by confidence descending and take top N for the message
  const sorted = [...newP0Issues].sort((a, b) => b.confidence - a.confidence);
  const shown = sorted.slice(0, MAX_P0_BLOCKS_IN_MESSAGE);
  const truncated = newP0Issues.length - shown.length;

  const completedDate = metadata.completedAt.split('T')[0] ?? metadata.completedAt;
  const completedTime = (metadata.completedAt.split('T')[1] ?? '').slice(0, 5);
  const summaryLine = [
    `🕒 *${completedDate} ${completedTime} UTC*`,
    `📄 *${metadata.articlesAudited}* audited`,
    `🚨 *${newP0Issues.length}* new P0`,
    notionPageUrl ? `<${notionPageUrl}|*Open full report in Notion →*>` : '📝 Notion updated',
  ].join('  ·  ');

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚨 Delta Support Audit — ${newP0Issues.length} new P0 ${newP0Issues.length === 1 ? 'issue' : 'issues'}`,
        emoji: true,
      },
    },
    { type: 'context', elements: [{ type: 'mrkdwn', text: summaryLine }] },
    { type: 'divider' },
  ];

  for (let i = 0; i < shown.length; i++) {
    const issue = shown[i]!;
    const owner = issue.suggestedOwner ?? 'Unassigned';
    const oEmoji = ownerEmoji(issue.suggestedOwner);

    const lines: string[] = [];
    lines.push(`*${i + 1}. ${truncate(issue.summary, 220)}*`);
    lines.push(`${oEmoji} *Owner:* ${owner}  ·  *Confidence:* ${issue.confidence.toFixed(2)}`);
    if (issue.supportQuote) {
      lines.push(`> *Support:* ${truncate(issue.supportQuote, 180)}`);
    }
    if (issue.sotQuote) {
      lines.push(`> *SoT:* ${truncate(issue.sotQuote, 180)}`);
    }
    const linkLine: string[] = [];
    if (issue.supportUrl) linkLine.push(`<${issue.supportUrl}|Support →>`);
    if (issue.sotUrl) linkLine.push(`<${issue.sotUrl}|SoT →>`);
    if (linkLine.length > 0) lines.push(linkLine.join('  ·  '));

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    });

    // Divider between issues (skip after last)
    if (i < shown.length - 1) {
      blocks.push({ type: 'divider' });
    }
  }

  if (truncated > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_+${truncated} more P0 ${truncated === 1 ? 'issue' : 'issues'} not shown — ${
            notionPageUrl ? `<${notionPageUrl}|see full list in Notion →>` : 'open Notion for full list'
          }_`,
        },
      ],
    });
  }

  return {
    text: `Delta Support Audit — ${newP0Issues.length} new P0 issue(s)`,
    blocks,
  };
}

async function postWithRetry(url: string, payload: unknown): Promise<void> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) return;
    if (TRANSIENT_STATUSES.has(r.status) && attempt < maxAttempts) {
      await sleep(1000 * 2 ** (attempt - 1));
      continue;
    }
    const text = await r.text().catch(() => '');
    throw new Error(`Slack ${r.status}: ${text.slice(0, 200)}`);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
