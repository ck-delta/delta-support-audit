import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { complete, OpenRouterError } from '@/lib/llm/openrouter';

const cfg = { apiKey: 'sk-test', model: 'anthropic/claude-test' };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mockFetchOnce(status: number, body: object | string): void {
  const fn = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  vi.stubGlobal('fetch', fn);
}

function mockFetchSequence(...responses: Array<{ status: number; body: object | string }>): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
    });
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('openrouter complete()', () => {
  it('returns content + usage on 200', async () => {
    mockFetchOnce(200, {
      choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    });
    const r = await complete('hi', { jsonMode: true }, cfg);
    expect(r.content).toBe('{"ok":true}');
    expect(r.usage.totalTokens).toBe(14);
  });

  it('retries on transient 503', async () => {
    const fn = mockFetchSequence(
      { status: 503, body: 'service unavailable' },
      { status: 200, body: { choices: [{ message: { role: 'assistant', content: 'ok' } }], usage: {} } },
    );
    const r = await complete('hi', {}, cfg);
    expect(r.content).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws OpenRouterError on 4xx without retry', async () => {
    const fn = mockFetchSequence({ status: 401, body: 'invalid auth' });
    await expect(complete('hi', {}, cfg)).rejects.toBeInstanceOf(OpenRouterError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after maxAttempts when all transient', async () => {
    mockFetchSequence(
      { status: 503, body: 'fail' },
      { status: 503, body: 'fail' },
      { status: 503, body: 'fail' },
    );
    await expect(complete('hi', {}, cfg)).rejects.toBeInstanceOf(OpenRouterError);
  });

  it('passes jsonMode → response_format', async () => {
    const fn = mockFetchSequence({
      status: 200,
      body: { choices: [{ message: { role: 'assistant', content: '{}' } }], usage: {} },
    });
    await complete('hi', { jsonMode: true }, cfg);
    const callBody = JSON.parse(fn.mock.calls[0]![1].body as string);
    expect(callBody.response_format).toEqual({ type: 'json_object' });
  });

  it('omits response_format when jsonMode is false', async () => {
    const fn = mockFetchSequence({
      status: 200,
      body: { choices: [{ message: { role: 'assistant', content: 'plain' } }], usage: {} },
    });
    await complete('hi', {}, cfg);
    const callBody = JSON.parse(fn.mock.calls[0]![1].body as string);
    expect(callBody.response_format).toBeUndefined();
  });
});
