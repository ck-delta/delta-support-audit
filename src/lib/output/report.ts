import type {
  AuditReport,
  ConflictIssue,
  CoverageIssue,
  Issue,
  RunMetadata,
} from '@/lib/types';

export interface ArticleAuditOutcome {
  issues: Issue[];
  conflicts: ConflictIssue[];
}

export interface BuildReportInput {
  articleResults: ArticleAuditOutcome[];
  coverageGaps: CoverageIssue[];
  metadata: RunMetadata;
}

export function buildReport(input: BuildReportInput): AuditReport {
  const allIssues: Issue[] = [];
  const conflictMap = new Map<string, ConflictIssue>();
  for (const r of input.articleResults) {
    allIssues.push(...r.issues);
    for (const c of r.conflicts) {
      // dedupe conflicts found by multiple articles using their id
      if (!conflictMap.has(c.id)) conflictMap.set(c.id, c);
    }
  }

  const issuesBySeverity = {
    P0: sortIssues(allIssues.filter((i) => i.severity === 'P0')),
    P1: sortIssues(allIssues.filter((i) => i.severity === 'P1')),
    P2: sortIssues(allIssues.filter((i) => i.severity === 'P2')),
  };
  const conflicts = sortBySeverityThenConfidence(Array.from(conflictMap.values()));
  const coverageGaps = sortBySeverityThenConfidence(input.coverageGaps);

  return {
    metadata: input.metadata,
    issuesBySeverity,
    conflicts,
    coverageGaps,
  };
}

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    if (a.status !== b.status) {
      const order = { new: 0, 'still-open': 1, resolved: 2 } as const;
      return order[a.status] - order[b.status];
    }
    return b.confidence - a.confidence;
  });
}

function sortBySeverityThenConfidence<T extends { severity: 'P0' | 'P1' | 'P2'; confidence: number }>(
  items: T[],
): T[] {
  const sevOrder = { P0: 0, P1: 1, P2: 2 } as const;
  return [...items].sort((a, b) => {
    if (a.severity !== b.severity) return sevOrder[a.severity] - sevOrder[b.severity];
    return b.confidence - a.confidence;
  });
}

export function newP0Issues(report: AuditReport): Issue[] {
  return report.issuesBySeverity.P0.filter((i) => i.status === 'new');
}

export function totalsBySeverity(report: AuditReport): { P0: number; P1: number; P2: number } {
  return {
    P0: report.issuesBySeverity.P0.length,
    P1: report.issuesBySeverity.P1.length,
    P2: report.issuesBySeverity.P2.length,
  };
}

export function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1_000_000) * 3 + (completionTokens / 1_000_000) * 15;
}
