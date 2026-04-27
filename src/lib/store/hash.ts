import { createHash } from 'node:crypto';
import type { Redis } from '@upstash/redis';
import type { Source, HashRecord } from '@/lib/types';

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function hashKey(source: Source, stableId: string): string {
  return `hash:${source}:${stableId}`;
}

export interface DiffResult {
  changed: boolean;
  isNew: boolean;
  prev?: HashRecord;
  next: HashRecord;
}

export function diff(prev: HashRecord | null | undefined, newSha: string, now: string): DiffResult {
  if (!prev) {
    return { changed: true, isNew: true, next: { sha256: newSha, lastSeen: now, lastChanged: now } };
  }
  if (prev.sha256 === newSha) {
    return { changed: false, isNew: false, prev, next: { ...prev, lastSeen: now } };
  }
  return {
    changed: true,
    isNew: false,
    prev,
    next: { sha256: newSha, lastSeen: now, lastChanged: now },
  };
}

export async function loadHash(redis: Redis, key: string): Promise<HashRecord | null> {
  const v = await redis.get<HashRecord | null>(key);
  return v ?? null;
}

export async function storeHash(redis: Redis, key: string, record: HashRecord): Promise<void> {
  await redis.set(key, record);
}
