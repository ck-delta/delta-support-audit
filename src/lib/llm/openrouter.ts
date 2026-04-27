const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 60_000;

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  appName?: string;
  appUrl?: string;
}

export interface CompletionOptions {
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface CompletionResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class OpenRouterError extends Error {
  constructor(
    public readonly status: number,
    public readonly raw: string,
    message: string,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

export function configFromEnv(): OpenRouterConfig {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6';
  if (!apiKey) throw new Error('OPENROUTER_API_KEY env var is required');
  return {
    apiKey,
    model,
    appName: 'Delta Support Audit',
    appUrl: 'https://github.com/delta-exchange/support-audit',
  };
}

interface OpenRouterChoice {
  message: { role: 'assistant'; content: string };
  finish_reason?: string;
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message: string; code?: string };
}

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504, 524]);

export async function complete(
  prompt: string,
  opts: CompletionOptions = {},
  cfg: OpenRouterConfig = configFromEnv(),
): Promise<CompletionResult> {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.0,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.jsonMode) body['response_format'] = { type: 'json_object' };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (cfg.appName) headers['X-Title'] = cfg.appName;
  if (cfg.appUrl) headers['HTTP-Referer'] = cfg.appUrl;

  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await r.text();
      if (!r.ok) {
        if (TRANSIENT_STATUSES.has(r.status) && attempt < maxAttempts) {
          await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        throw new OpenRouterError(r.status, text, `OpenRouter ${r.status}: ${text.slice(0, 200)}`);
      }
      const json = JSON.parse(text) as OpenRouterResponse;
      if (json.error) {
        throw new OpenRouterError(r.status, text, `OpenRouter error: ${json.error.message}`);
      }
      const content = json.choices[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new OpenRouterError(r.status, text, 'OpenRouter response missing message content');
      }
      const usage = json.usage ?? {};
      const result: CompletionResult = {
        content,
        usage: {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
      };
      logUsage(cfg.model, result.usage);
      return result;
    } catch (e) {
      lastErr = e;
      if (e instanceof OpenRouterError && !TRANSIENT_STATUSES.has(e.status)) throw e;
      if (attempt < maxAttempts) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('OpenRouter call failed');
}

function logUsage(model: string, u: CompletionResult['usage']): void {
  console.error(
    `[openrouter] model=${model} prompt=${u.promptTokens} completion=${u.completionTokens} total=${u.totalTokens}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
