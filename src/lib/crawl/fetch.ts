const USER_AGENT = 'DeltaSupportAudit/0.1 (+contact@delta.exchange)';
const DEFAULT_TIMEOUT_MS = 20_000;

export class FetchError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  acceptStatus?: number[];
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...(opts.headers ?? {}) },
      signal: controller.signal,
      redirect: 'follow',
    });
    const accept = opts.acceptStatus ?? [200];
    if (!accept.includes(r.status)) {
      throw new FetchError(url, r.status, `Unexpected status ${r.status} for ${url}`);
    }
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, opts);
  return JSON.parse(text) as T;
}

const DEFAULT_RPS = 2;

export class Throttle {
  private next = 0;
  constructor(private readonly rps: number = DEFAULT_RPS) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const minGap = 1000 / this.rps;
    const wait = Math.max(0, this.next - now);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    this.next = Math.max(now, this.next) + minGap;
  }
}
