import { describe, it, expect, vi } from 'vitest';
import { upsertChunks, retrieveTopK, deleteChunks } from '@/lib/store/vector';
import type { PreparedChunk } from '@/lib/types';

function mockIndex() {
  return {
    upsert: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([
      {
        id: 'guides:trading-guide/leverage#0',
        score: 0.91,
        data: 'Leverage allows...',
        metadata: {
          source: 'guides',
          articleStableId: 'trading-guide/leverage',
          articleTitle: 'Leverage',
          articleUrl: 'https://guides.delta.exchange/.../leverage',
          sectionHeading: 'Leverage',
          chunkIndex: 0,
        },
      },
    ]),
  };
}

describe('vector store', () => {
  it('upsertChunks no-ops on empty input', async () => {
    const idx = mockIndex();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await upsertChunks([], idx as any);
    expect(idx.upsert).not.toHaveBeenCalled();
  });

  it('upsertChunks sends id/data/metadata payload', async () => {
    const idx = mockIndex();
    const chunks: PreparedChunk[] = [
      {
        id: 'guides:foo#0',
        text: 'body',
        metadata: {
          source: 'guides',
          articleStableId: 'foo',
          articleTitle: 'Foo',
          articleUrl: 'https://example.com',
          sectionHeading: 'Foo',
          chunkIndex: 0,
        },
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await upsertChunks(chunks, idx as any);
    expect(idx.upsert).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'guides:foo#0', data: 'body' }),
    ]);
  });

  it('retrieveTopK returns mapped results without filter by default', async () => {
    const idx = mockIndex();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await retrieveTopK('what is leverage', 3, {}, idx as any);
    expect(idx.query).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'what is leverage', topK: 3, includeData: true, includeMetadata: true }),
    );
    expect(idx.query).toHaveBeenCalledWith(expect.not.objectContaining({ filter: expect.anything() }));
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('guides:trading-guide/leverage#0');
    expect(results[0]?.score).toBe(0.91);
    expect(results[0]?.metadata.source).toBe('guides');
  });

  it('retrieveTopK applies sourceFilter as metadata expression', async () => {
    const idx = mockIndex();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await retrieveTopK('q', 5, { sourceFilter: 'docs' }, idx as any);
    expect(idx.query).toHaveBeenCalledWith(
      expect.objectContaining({ filter: "source = 'docs'" }),
    );
  });

  it('deleteChunks no-ops on empty input', async () => {
    const idx = mockIndex();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteChunks([], idx as any);
    expect(idx.delete).not.toHaveBeenCalled();
  });
});
