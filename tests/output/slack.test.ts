import { describe, it, expect, vi, afterEach } from 'vitest';
import { postP0Summary, buildBlockKitPayload } from '@/lib/output/slack';
import type { Issue, RunMetadata } from '@/lib/types';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SLACK_WEBHOOK_URL;
});

const NOW = '2026-04-27T00:00:00.000Z';

function meta(overrides: Partial<RunMetadata> = {}): RunMetadata {
  return {
    startedAt: NOW,
    completedAt: NOW,
    model: 'anthropic/claude-sonnet-4.6',
    articlesChecked: 5,
    articlesChanged: 3,
    articlesAudited: 3,
    totalIssues: 1,
    newIssues: 1,
    stillOpenIssues: 0,
    resolvedIssues: 0,
    totalConflicts: 0,
    totalCoverageGaps: 0,
    promptTokens: 100,
    completionTokens: 20,
    costEstimateUsd: 0.001,
    truncated: false,
    durationMs: 10_000,
    errors: 0,
    ...overrides,
  };
}

function p0(id = 'a'): Issue {
  return {
    id,
    type: 'contradiction',
    severity: 'P0',
    summary: `Wrong fee for ${id}`,
    supportUrl: 'https://example.com/support/x',
    sotUrl: 'https://example.com/sot/y',
    supportQuote: '0.05% taker fee',
    sotQuote: '0.025% taker fee',
    confidence: 0.85,
    suggestedOwner: 'Support',
    status: 'new',
    firstSeenAt: NOW,
    lastSeenAt: NOW,
  };
}

describe('postP0Summary', () => {
  it('does nothing when there are no P0s', async () => {
    const fn = vi.fn();
    vi.stubGlobal('fetch', fn);
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/x';
    await postP0Summary({ newP0Issues: [], metadata: meta() });
    expect(fn).not.toHaveBeenCalled();
  });

  it('throws if SLACK_WEBHOOK_URL is missing and there are P0s', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    await expect(postP0Summary({ newP0Issues: [p0()], metadata: meta() })).rejects.toThrow(
      /SLACK_WEBHOOK_URL/,
    );
  });

  it('posts to webhook with Block Kit shape on success', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/x';
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    vi.stubGlobal('fetch', fetchFn);
    await postP0Summary({ newP0Issues: [p0(), p0('b')], metadata: meta() });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://hooks.slack.test/x');
    const body = JSON.parse(init.body);
    expect(body.blocks[0]).toMatchObject({ type: 'header' });
    expect(body.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'header' }),
        expect.objectContaining({ type: 'context' }),
        expect.objectContaining({ type: 'divider' }),
        expect.objectContaining({ type: 'section' }),
      ]),
    );
  });
});

describe('buildBlockKitPayload', () => {
  it('groups multiple P0s into one message', () => {
    const payload = buildBlockKitPayload({
      newP0Issues: [p0('a'), p0('b'), p0('c')],
      metadata: meta(),
    });
    const sections = (payload.blocks as Array<{ type: string }>).filter((b) => b.type === 'section');
    expect(sections).toHaveLength(3);
  });

  it('includes notion link in the context line when provided', () => {
    const payload = buildBlockKitPayload({
      newP0Issues: [p0()],
      metadata: meta(),
      notionPageUrl: 'https://notion.so/page-123',
    });
    const context = (payload.blocks as Array<{ type: string; elements?: Array<{ text: string }> }>).find(
      (b) => b.type === 'context',
    );
    const text = context?.elements?.[0]?.text ?? '';
    expect(text).toContain('Open full report in Notion');
    expect(text).toContain('https://notion.so/page-123');
  });
});
