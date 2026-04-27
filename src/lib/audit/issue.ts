import { z } from 'zod';
import { sha256 } from '@/lib/store/hash';
import type {
  Issue,
  ConflictIssue,
  Severity,
  SuggestedOwner,
} from '@/lib/types';

const SeveritySchema = z.enum(['P0', 'P1', 'P2']);
const OwnerSchema = z.enum(['Support', 'Docs', 'Engineering', 'Product']);

const RawIssueSchema = z.object({
  type: z.literal('contradiction'),
  severity: SeveritySchema,
  support_quote: z.string().max(400),
  sot_quote: z.string().max(400),
  sot_url: z.string(),
  summary: z.string(),
  suggested_owner: OwnerSchema.optional(),
  confidence: z.number().min(0).max(1),
});

const RawConflictSchema = z.object({
  severity: SeveritySchema,
  guides_quote: z.string().max(400),
  guides_url: z.string(),
  docs_quote: z.string().max(400),
  docs_url: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
});

export const AuditResponseSchema = z.object({
  issues: z.array(RawIssueSchema).default([]),
  conflicts: z.array(RawConflictSchema).default([]),
});

export interface ParsedAudit {
  issues: Issue[];
  conflicts: ConflictIssue[];
}

export function parseAuditResponse(raw: string, supportUrl: string, runTimestamp: string): ParsedAudit {
  const json = extractFirstJsonObject(raw);
  const parsed = AuditResponseSchema.parse(json);
  const issues: Issue[] = parsed.issues.map((r) => {
    const id = issueIdFor(r.sot_url, r.summary);
    const issue: Issue = {
      id,
      type: 'contradiction',
      severity: r.severity,
      supportUrl,
      sotUrl: r.sot_url,
      supportQuote: r.support_quote,
      sotQuote: r.sot_quote,
      summary: r.summary,
      confidence: r.confidence,
      status: 'new',
      firstSeenAt: runTimestamp,
      lastSeenAt: runTimestamp,
    };
    if (r.suggested_owner) issue.suggestedOwner = r.suggested_owner;
    return issue;
  });
  const conflicts: ConflictIssue[] = parsed.conflicts.map((r) => ({
    id: conflictIdFor(r.guides_url, r.docs_url, r.summary),
    severity: r.severity,
    guidesQuote: r.guides_quote,
    guidesUrl: r.guides_url,
    docsQuote: r.docs_quote,
    docsUrl: r.docs_url,
    summary: r.summary,
    confidence: r.confidence,
    status: 'new',
    firstSeenAt: runTimestamp,
    lastSeenAt: runTimestamp,
  }));
  return { issues, conflicts };
}

export function issueIdFor(sotUrl: string, summary: string): string {
  return sha256(`${sotUrl}|${canonicalSummary(summary)}`);
}

export function conflictIdFor(guidesUrl: string, docsUrl: string, summary: string): string {
  return sha256(`${guidesUrl}|${docsUrl}|${canonicalSummary(summary)}`);
}

export function canonicalSummary(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

const FLOOR_DEFAULT = { P0: 0.6, P1: 0.6, P2: 0.7 };

function getFloor(sev: Severity): number {
  const env = process.env;
  const raw =
    sev === 'P0'
      ? env.CONFIDENCE_FLOOR_P0
      : sev === 'P1'
        ? env.CONFIDENCE_FLOOR_P1
        : env.CONFIDENCE_FLOOR_P2;
  const n = raw === undefined ? FLOOR_DEFAULT[sev] : Number(raw);
  return Number.isFinite(n) ? n : FLOOR_DEFAULT[sev];
}

export function passesConfidenceFloor(item: { severity: Severity; confidence: number }): boolean {
  return item.confidence >= getFloor(item.severity);
}

export function filterByConfidence<T extends { severity: Severity; confidence: number }>(
  items: T[],
): T[] {
  return items.filter(passesConfidenceFloor);
}

function extractFirstJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fallback: pull first {...} block
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`Could not find JSON object in response (len=${raw.length})`);
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

export type { Issue, ConflictIssue, Severity, SuggestedOwner };
