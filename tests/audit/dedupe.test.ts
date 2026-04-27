import { describe, it, expect, vi } from 'vitest';
import { markIssues } from '@/lib/audit/dedupe';
import type { Issue } from '@/lib/types';

const NOW = '2026-04-28T00:00:00.000Z';
const PREV = '2026-04-27T00:00:00.000Z';
const URL = 'https://example.com/article';

function issue(id: string, firstSeenAt = NOW, lastSeenAt = NOW): Issue {
  return {
    id,
    type: 'contradiction',
    severity: 'P1',
    summary: `summary-${id}`,
    confidence: 0.9,
    status: 'new',
    firstSeenAt,
    lastSeenAt,
  };
}

function mockRedis(initial: Issue[] | null = null) {
  let stored: Issue[] | null = initial;
  return {
    get: vi.fn(async () => stored),
    set: vi.fn(async (_k: string, v: Issue[]) => {
      stored = v;
    }),
    _stored: () => stored,
  };
}

describe('markIssues', () => {
  it('classifies first-time issue as new', async () => {
    const r = mockRedis();
    const out = await markIssues(URL, [issue('a')], NOW, r as unknown as never);
    expect(out.counts).toEqual({ new: 1, stillOpen: 0, resolved: 0 });
    expect(out.marked[0]?.status).toBe('new');
    expect(out.marked[0]?.firstSeenAt).toBe(NOW);
  });

  it('classifies repeat issue as still-open and preserves firstSeenAt', async () => {
    const r = mockRedis([issue('a', PREV, PREV)]);
    const out = await markIssues(URL, [issue('a')], NOW, r as unknown as never);
    expect(out.counts).toEqual({ new: 0, stillOpen: 1, resolved: 0 });
    expect(out.marked[0]?.status).toBe('still-open');
    expect(out.marked[0]?.firstSeenAt).toBe(PREV);
    expect(out.marked[0]?.lastSeenAt).toBe(NOW);
  });

  it('classifies missing prior issue as resolved', async () => {
    const r = mockRedis([issue('a', PREV, PREV), issue('b', PREV, PREV)]);
    const out = await markIssues(URL, [issue('a')], NOW, r as unknown as never);
    expect(out.counts).toEqual({ new: 0, stillOpen: 1, resolved: 1 });
    expect(out.resolved[0]?.id).toBe('b');
    expect(out.resolved[0]?.status).toBe('resolved');
  });

  it('persists the marked (non-resolved) issues for next run', async () => {
    const r = mockRedis([issue('a', PREV, PREV)]);
    await markIssues(URL, [issue('a'), issue('c')], NOW, r as unknown as never);
    expect(r._stored()).toHaveLength(2);
    expect(r._stored()?.map((i) => i.id).sort()).toEqual(['a', 'c']);
  });
});
