import { describe, it, expect } from 'vitest';
import { buildReport, newP0Issues, totalsBySeverity, estimateCostUsd } from '@/lib/output/report';
import type { ConflictIssue, Issue, RunMetadata } from '@/lib/types';

const NOW = '2026-04-27T00:00:00.000Z';

function meta(): RunMetadata {
  return {
    startedAt: NOW,
    completedAt: NOW,
    model: 'm',
    articlesChecked: 1,
    articlesChanged: 1,
    articlesAudited: 1,
    totalIssues: 0,
    newIssues: 0,
    stillOpenIssues: 0,
    resolvedIssues: 0,
    totalConflicts: 0,
    totalCoverageGaps: 0,
    promptTokens: 0,
    completionTokens: 0,
    costEstimateUsd: 0,
    truncated: false,
    durationMs: 0,
    errors: 0,
  };
}

function issue(id: string, severity: Issue['severity'], status: Issue['status'] = 'new', confidence = 0.8): Issue {
  return {
    id,
    type: 'contradiction',
    severity,
    summary: `summary-${id}`,
    confidence,
    status,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
  };
}

function conflict(id: string, severity: ConflictIssue['severity']): ConflictIssue {
  return {
    id,
    severity,
    guidesQuote: '',
    guidesUrl: '',
    docsQuote: '',
    docsUrl: '',
    summary: `c-${id}`,
    confidence: 0.9,
    status: 'new',
    firstSeenAt: NOW,
    lastSeenAt: NOW,
  };
}

describe('buildReport', () => {
  it('groups issues by severity', () => {
    const r = buildReport({
      articleResults: [
        { issues: [issue('a', 'P0'), issue('b', 'P1'), issue('c', 'P2')], conflicts: [] },
      ],
      coverageGaps: [],
      metadata: meta(),
    });
    expect(r.issuesBySeverity.P0).toHaveLength(1);
    expect(r.issuesBySeverity.P1).toHaveLength(1);
    expect(r.issuesBySeverity.P2).toHaveLength(1);
  });

  it('sorts P0s with new before still-open before resolved', () => {
    const r = buildReport({
      articleResults: [
        {
          issues: [
            issue('a', 'P0', 'still-open', 0.9),
            issue('b', 'P0', 'new', 0.8),
            issue('c', 'P0', 'resolved', 0.95),
          ],
          conflicts: [],
        },
      ],
      coverageGaps: [],
      metadata: meta(),
    });
    expect(r.issuesBySeverity.P0.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('dedupes identical conflicts found by multiple articles', () => {
    const c = conflict('shared', 'P1');
    const r = buildReport({
      articleResults: [
        { issues: [], conflicts: [c] },
        { issues: [], conflicts: [c] },
        { issues: [], conflicts: [conflict('other', 'P1')] },
      ],
      coverageGaps: [],
      metadata: meta(),
    });
    expect(r.conflicts).toHaveLength(2);
  });
});

describe('newP0Issues + totalsBySeverity', () => {
  it('returns only new P0s', () => {
    const r = buildReport({
      articleResults: [
        {
          issues: [issue('a', 'P0', 'new'), issue('b', 'P0', 'still-open'), issue('c', 'P1', 'new')],
          conflicts: [],
        },
      ],
      coverageGaps: [],
      metadata: meta(),
    });
    expect(newP0Issues(r).map((i) => i.id)).toEqual(['a']);
    expect(totalsBySeverity(r)).toEqual({ P0: 2, P1: 1, P2: 0 });
  });
});

describe('estimateCostUsd', () => {
  it('uses $3/MTok input + $15/MTok output', () => {
    expect(estimateCostUsd(1_000_000, 0)).toBeCloseTo(3, 5);
    expect(estimateCostUsd(0, 1_000_000)).toBeCloseTo(15, 5);
    expect(estimateCostUsd(500_000, 100_000)).toBeCloseTo(1.5 + 1.5, 5);
  });
});
