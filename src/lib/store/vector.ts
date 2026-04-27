import { Index } from '@upstash/vector';
import type { ChunkMetadata, PreparedChunk, RetrievedChunk, Source } from '@/lib/types.js';

type VectorIndex = Index<Record<string, unknown>>;

let client: VectorIndex | null = null;

export function vec(): VectorIndex {
  if (client) return client;
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN must be set in the environment.',
    );
  }
  client = new Index<Record<string, unknown>>({ url, token });
  return client;
}

export function resetVecForTests(): void {
  client = null;
}

export interface RetrieveOptions {
  sourceFilter?: Source;
}

export async function upsertChunks(
  chunks: PreparedChunk[],
  client_: VectorIndex = vec(),
): Promise<void> {
  if (chunks.length === 0) return;
  await client_.upsert(
    chunks.map((c) => ({
      id: c.id,
      data: c.text,
      metadata: c.metadata as unknown as Record<string, unknown>,
    })),
  );
}

export async function deleteChunks(
  ids: string[],
  client_: VectorIndex = vec(),
): Promise<void> {
  if (ids.length === 0) return;
  await client_.delete(ids);
}

export async function retrieveTopK(
  query: string,
  k = 8,
  opts: RetrieveOptions = {},
  client_: VectorIndex = vec(),
): Promise<RetrievedChunk[]> {
  const filter = opts.sourceFilter ? `source = '${opts.sourceFilter}'` : undefined;
  const res = await client_.query({
    data: query,
    topK: k,
    includeData: true,
    includeMetadata: true,
    ...(filter ? { filter } : {}),
  });
  return res.map((r) => ({
    id: String(r.id),
    score: r.score,
    data: r.data ?? '',
    metadata: (r.metadata ?? {}) as unknown as ChunkMetadata,
  }));
}
