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

export function buildBlockKitPayload(input: SlackPostInput): Record<string, unknown> {
  const { newP0Issues, metadata, notionPageUrl } = input;
  const total = `P0=${metadata.totalIssues}` ;
  const summaryLine = `Run: ${metadata.completedAt} · Articles audited: ${metadata.articlesAudited} · New P0: ${newP0Issues.length}${
    notionPageUrl ? ` · <${notionPageUrl}|Full report>` : ''
  }`;

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Delta Support Audit — ${newP0Issues.length} new P0 issue(s)` },
    },
    { type: 'context', elements: [{ type: 'mrkdwn', text: summaryLine }] },
    { type: 'divider' },
  ];

  for (let i = 0; i < newP0Issues.length; i++) {
    const issue = newP0Issues[i]!;
    const owner = issue.suggestedOwner ?? '?';
    const lines = [
      `*Issue ${i + 1}: ${truncate(issue.summary, 220)}*`,
      issue.supportUrl ? `Support: ${issue.supportUrl}` : '',
      issue.sotUrl ? `SoT: ${issue.sotUrl}` : '',
      issue.supportQuote ? `> support: ${truncate(issue.supportQuote, 200)}` : '',
      issue.sotQuote ? `> sot: ${truncate(issue.sotQuote, 200)}` : '',
      `confidence ${issue.confidence.toFixed(2)} · suggested owner: ${owner}`,
    ].filter(Boolean);
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    });
  }

  return {
    text: `Delta Support Audit — ${newP0Issues.length} new P0 issue(s) · ${total}`,
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
