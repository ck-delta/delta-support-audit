import { complete } from '@/lib/llm/openrouter';
import { loadPrompt, renderPrompt } from '@/lib/llm/prompts';
import { retrieveSotForArticle, formatChunksForPrompt } from './retrieve';
import { parseAuditResponse, filterByConfidence } from './issue';
import type { Article, Issue, ConflictIssue } from '@/lib/types';

export interface AuditOptions {
  k?: number;
  showPrompt?: boolean;
  runTimestamp?: string;
}

export interface AuditResult {
  issues: Issue[];
  conflicts: ConflictIssue[];
  promptTokens: number;
  completionTokens: number;
  errored?: string;
}

export async function auditArticle(article: Article, opts: AuditOptions = {}): Promise<AuditResult> {
  const k = opts.k ?? 5;
  const runTimestamp = opts.runTimestamp ?? new Date().toISOString();
  const empty: AuditResult = { issues: [], conflicts: [], promptTokens: 0, completionTokens: 0 };

  let retrieved;
  try {
    retrieved = await retrieveSotForArticle(article, k);
  } catch (e) {
    return { ...empty, errored: `retrieve: ${(e as Error).message}` };
  }

  const prompt = renderPrompt(loadPrompt('compare'), {
    article_url: article.url,
    article_title: article.title,
    article_text: article.text.slice(0, 12_000),
    k: String(k),
    guides_chunks: formatChunksForPrompt(retrieved.guides),
    docs_chunks: formatChunksForPrompt(retrieved.docs),
  });

  if (opts.showPrompt) {
    console.error('\n========== PROMPT ==========\n');
    console.error(prompt);
    console.error('\n========== /PROMPT =========\n');
  }

  let raw;
  try {
    raw = await complete(prompt, { jsonMode: true, maxTokens: 2048 });
  } catch (e) {
    return { ...empty, errored: `llm: ${(e as Error).message}` };
  }

  let parsed;
  try {
    parsed = parseAuditResponse(raw.content, article.url, runTimestamp);
  } catch (e) {
    console.error(`[compare] parse error for ${article.url}: ${(e as Error).message}`);
    console.error(`[compare] raw response (first 500 chars): ${raw.content.slice(0, 500)}`);
    return {
      ...empty,
      promptTokens: raw.usage.promptTokens,
      completionTokens: raw.usage.completionTokens,
      errored: `parse: ${(e as Error).message}`,
    };
  }

  return {
    issues: filterByConfidence(parsed.issues),
    conflicts: filterByConfidence(parsed.conflicts),
    promptTokens: raw.usage.promptTokens,
    completionTokens: raw.usage.completionTokens,
  };
}
