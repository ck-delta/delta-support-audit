import type { Redis } from '@upstash/redis';
import { kv } from '@/lib/store/kv';
import type { Issue, DedupStatus } from '@/lib/types';

function key(supportUrl: string): string {
  return `issues:${supportUrl}`;
}

export async function loadOpenIssues(supportUrl: string, redis: Redis = kv()): Promise<Issue[]> {
  const v = await redis.get<Issue[] | null>(key(supportUrl));
  return v ?? [];
}

export async function markIssues(
  supportUrl: string,
  newRunIssues: Issue[],
  runTimestamp: string,
  redis: Redis = kv(),
): Promise<{ marked: Issue[]; resolved: Issue[]; counts: { new: number; stillOpen: number; resolved: number } }> {
  const prev = await loadOpenIssues(supportUrl, redis);
  const prevById = new Map(prev.map((i) => [i.id, i]));
  const newById = new Map(newRunIssues.map((i) => [i.id, i]));

  const marked: Issue[] = [];
  for (const issue of newRunIssues) {
    const existing = prevById.get(issue.id);
    if (existing) {
      marked.push({
        ...issue,
        status: 'still-open',
        firstSeenAt: existing.firstSeenAt,
        lastSeenAt: runTimestamp,
      });
    } else {
      marked.push({ ...issue, status: 'new', firstSeenAt: runTimestamp, lastSeenAt: runTimestamp });
    }
  }

  const resolved: Issue[] = [];
  for (const old of prev) {
    if (!newById.has(old.id)) {
      resolved.push({ ...old, status: 'resolved', lastSeenAt: runTimestamp });
    }
  }

  await redis.set(key(supportUrl), marked);

  return {
    marked,
    resolved,
    counts: {
      new: marked.filter((i) => i.status === 'new').length,
      stillOpen: marked.filter((i) => i.status === 'still-open').length,
      resolved: resolved.length,
    },
  };
}

export type { DedupStatus };
