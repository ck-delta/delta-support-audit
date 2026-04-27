import { describe, it, expect } from 'vitest';
import { runPool } from '@/lib/util/pool';

async function* range(n: number): AsyncGenerator<number> {
  for (let i = 0; i < n; i++) yield i;
}

describe('runPool', () => {
  it('processes all items via worker + onResult', async () => {
    const seen: number[] = [];
    await runPool(
      range(5),
      async (n) => n * 2,
      (r) => {
        seen.push(r);
      },
      { concurrency: 2 },
    );
    expect(seen.sort((a, b) => a - b)).toEqual([0, 2, 4, 6, 8]);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    await runPool(
      range(10),
      async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return null;
      },
      () => {},
      { concurrency: 3 },
    );
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('reports truncated=true when shouldStop fires', async () => {
    let processed = 0;
    const result = await runPool(
      range(100),
      async () => {
        processed += 1;
        return null;
      },
      () => {},
      {
        concurrency: 2,
        shouldStop: () => processed >= 4,
      },
    );
    expect(result.truncated).toBe(true);
    expect(processed).toBeGreaterThanOrEqual(4);
    expect(processed).toBeLessThan(100);
  });

  it('continues on worker errors', async () => {
    const seen: number[] = [];
    await runPool(
      range(5),
      async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      },
      (r) => {
        seen.push(r as number);
      },
      { concurrency: 2 },
    );
    expect(seen.sort((a, b) => a - b)).toEqual([0, 1, 3, 4]);
  });
});
