import { z } from 'zod';
import { vec, retrieveTopK } from '@/lib/store/vector';
import { complete } from '@/lib/llm/openrouter';
import { loadPrompt, renderPrompt } from '@/lib/llm/prompts';
import { sha256 } from '@/lib/store/hash';
import type { CoverageIssue, Severity, SuggestedOwner } from '@/lib/types';

const SeveritySchema = z.enum(['P1', 'P2']);
const OwnerSchema = z.enum(['Support', 'Docs', 'Engineering', 'Product']);

const RawCoverageSchema = z.object({
  covered: z.boolean(),
  severity: SeveritySchema.optional(),
  missing_aspects: z.array(z.string()).optional(),
  summary: z.string().optional(),
  suggested_support_topic: z.string().optional(),
  suggested_owner: OwnerSchema.optional(),
  confidence: z.number().min(0).max(1),
});

export interface CoverageOptions {
  similarityThreshold?: number;
  limit?: number;
  runTimestamp?: string;
  onProgress?: (msg: string) => void;
}

export async function* findCoverageGaps(opts: CoverageOptions = {}): AsyncGenerator<CoverageIssue> {
  const threshold = opts.similarityThreshold ?? 0.7;
  const runTimestamp = opts.runTimestamp ?? new Date().toISOString();
  const onProgress = opts.onProgress ?? (() => {});

  const v = vec();
  let cursor: string | number = 0;
  let processed = 0;
  while (true) {
    if (opts.limit && processed >= opts.limit) break;
    const page: { vectors: Array<{ id: string | number; data?: string; metadata?: Record<string, unknown> }>; nextCursor?: string } = await v.range({
      cursor,
      limit: 50,
      includeData: true,
      includeMetadata: true,
    });
    if (page.vectors.length === 0) break;

    for (const chunk of page.vectors) {
      if (opts.limit && processed >= opts.limit) break;
      processed += 1;

      const meta = chunk.metadata;
      const source = meta?.['source'] as string | undefined;
      if (source !== 'guides' && source !== 'docs') continue;

      const sotText = chunk.data ?? '';
      const sotUrl = (meta?.['articleUrl'] as string | undefined) ?? '';
      if (!sotText || !sotUrl) continue;

      const supportMatches = await retrieveTopK(sotText.slice(0, 1500), 1, {
        sourceFilter: 'support',
      });
      const supportOnly = supportMatches[0];

      if (!supportOnly) {
        const issue = await llmCheckCoverage(
          source as 'guides' | 'docs',
          sotUrl,
          sotText,
          undefined,
          0,
          runTimestamp,
        );
        onProgress(`[${processed}] no support match → ${issue ? 'GAP' : 'covered (low conf)'}`);
        if (issue) yield issue;
        continue;
      }

      if (supportOnly.score >= threshold) {
        onProgress(`[${processed}] match score=${supportOnly.score.toFixed(2)} ≥ ${threshold} (covered)`);
        continue;
      }

      const issue = await llmCheckCoverage(
        source as 'guides' | 'docs',
        sotUrl,
        sotText,
        supportOnly.data,
        supportOnly.score,
        runTimestamp,
      );
      onProgress(
        `[${processed}] match score=${supportOnly.score.toFixed(2)} < ${threshold} → ${issue ? 'GAP' : 'covered (LLM)'}`,
      );
      if (issue) yield issue;
    }

    cursor = page.nextCursor ?? '';
    if (!cursor) break;
  }
}

async function llmCheckCoverage(
  sotSource: 'guides' | 'docs',
  sotUrl: string,
  sotText: string,
  supportText: string | undefined,
  similarity: number,
  runTimestamp: string,
): Promise<CoverageIssue | null> {
  const prompt = renderPrompt(loadPrompt('coverage'), {
    sot_source: sotSource,
    sot_url: sotUrl,
    sot_text: sotText.slice(0, 8000),
    support_text: (supportText ?? '(no close match found)').slice(0, 4000),
    similarity: similarity.toFixed(2),
  });

  let raw;
  try {
    raw = await complete(prompt, { jsonMode: true, maxTokens: 700 });
  } catch (e) {
    console.error(`[coverage] LLM error for ${sotUrl}: ${(e as Error).message}`);
    return null;
  }

  let parsed;
  try {
    parsed = RawCoverageSchema.parse(JSON.parse(raw.content.trim()));
  } catch {
    return null;
  }

  if (parsed.covered === true) return null;
  if (parsed.confidence < 0.7) return null;

  const severity: Severity = parsed.severity ?? 'P2';
  const summary = parsed.summary ?? 'Coverage gap detected';
  return {
    id: sha256(`coverage|${sotUrl}|${summary.toLowerCase()}`),
    severity,
    sotSource,
    sotUrl,
    sotText: sotText.slice(0, 1000),
    similarity,
    missingAspects: parsed.missing_aspects ?? [],
    suggestedSupportTopic: parsed.suggested_support_topic ?? '',
    suggestedOwner: (parsed.suggested_owner ?? 'Support') as SuggestedOwner,
    summary,
    confidence: parsed.confidence,
    status: 'new',
    firstSeenAt: runTimestamp,
    lastSeenAt: runTimestamp,
  };
}
