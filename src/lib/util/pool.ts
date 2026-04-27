export interface PoolOptions {
  concurrency: number;
  shouldStop?: () => boolean;
}

export async function runPool<T, R>(
  items: AsyncIterable<T>,
  worker: (item: T) => Promise<R>,
  onResult: (result: R, item: T) => void | Promise<void>,
  opts: PoolOptions,
): Promise<{ truncated: boolean }> {
  const queue: Array<{ item: T; promise: Promise<R> }> = [];
  let truncated = false;

  for await (const item of items) {
    if (opts.shouldStop?.()) {
      truncated = true;
      break;
    }
    queue.push({ item, promise: worker(item) });
    if (queue.length >= opts.concurrency) {
      const head = queue.shift()!;
      try {
        const r = await head.promise;
        await onResult(r, head.item);
      } catch {
        /* worker handles its own errors */
      }
    }
  }
  for (const q of queue) {
    try {
      const r = await q.promise;
      await onResult(r, q.item);
    } catch {
      /* worker handles its own errors */
    }
  }
  return { truncated };
}
