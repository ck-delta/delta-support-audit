import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseAuditResponse,
  issueIdFor,
  conflictIdFor,
  canonicalSummary,
  passesConfidenceFloor,
  filterByConfidence,
} from '@/lib/audit/issue';

const NOW = '2026-04-27T00:00:00.000Z';
const URL = 'https://deltaexchange.freshdesk.com/support/solutions/articles/123';

describe('parseAuditResponse', () => {
  it('parses well-formed response with issues + conflicts', () => {
    const raw = JSON.stringify({
      issues: [
        {
          type: 'contradiction',
          severity: 'P0',
          support_quote: 'taker fee is 0.05%',
          sot_quote: 'taker fee is 0.025%',
          sot_url: 'https://guides.delta.exchange/x',
          summary: 'Wrong taker fee in support',
          suggested_owner: 'Support',
          confidence: 0.85,
        },
      ],
      conflicts: [],
    });
    const out = parseAuditResponse(raw, URL, NOW);
    expect(out.issues).toHaveLength(1);
    expect(out.issues[0]?.severity).toBe('P0');
    expect(out.issues[0]?.suggestedOwner).toBe('Support');
    expect(out.issues[0]?.firstSeenAt).toBe(NOW);
    expect(out.conflicts).toEqual([]);
  });

  it('handles missing arrays via defaults', () => {
    const out = parseAuditResponse('{}', URL, NOW);
    expect(out.issues).toEqual([]);
    expect(out.conflicts).toEqual([]);
  });

  it('extracts JSON when wrapped in extra prose', () => {
    const raw = `Sure, here is the JSON:\n${JSON.stringify({ issues: [], conflicts: [] })}\n\nThanks!`;
    const out = parseAuditResponse(raw, URL, NOW);
    expect(out.issues).toEqual([]);
  });

  it('throws on unparseable input', () => {
    expect(() => parseAuditResponse('not json at all', URL, NOW)).toThrow();
  });

  it('throws on schema-invalid input (severity out of enum)', () => {
    const raw = JSON.stringify({
      issues: [
        {
          type: 'contradiction',
          severity: 'P9',
          support_quote: 'x',
          sot_quote: 'y',
          sot_url: 'z',
          summary: 's',
          confidence: 0.9,
        },
      ],
    });
    expect(() => parseAuditResponse(raw, URL, NOW)).toThrow();
  });
});

describe('issueIdFor / conflictIdFor', () => {
  it('issueIdFor is deterministic and stable across whitespace/case in summary', () => {
    const a = issueIdFor('https://x', 'Wrong taker fee in support');
    const b = issueIdFor('https://x', '  Wrong   taker fee in support ');
    const c = issueIdFor('https://x', 'wrong TAKER fee in support');
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('conflictIdFor is deterministic', () => {
    const a = conflictIdFor('g', 'd', 'summary');
    const b = conflictIdFor('g', 'd', 'summary');
    expect(a).toBe(b);
  });

  it('canonicalSummary normalizes whitespace + case', () => {
    expect(canonicalSummary('  Hello  WORLD ')).toBe('hello world');
  });
});

describe('passesConfidenceFloor', () => {
  beforeEach(() => {
    delete process.env.CONFIDENCE_FLOOR_P0;
    delete process.env.CONFIDENCE_FLOOR_P1;
    delete process.env.CONFIDENCE_FLOOR_P2;
  });
  afterEach(() => {
    delete process.env.CONFIDENCE_FLOOR_P0;
    delete process.env.CONFIDENCE_FLOOR_P1;
    delete process.env.CONFIDENCE_FLOOR_P2;
  });

  it('keeps P0 above 0.6 default', () => {
    expect(passesConfidenceFloor({ severity: 'P0', confidence: 0.61 })).toBe(true);
    expect(passesConfidenceFloor({ severity: 'P0', confidence: 0.59 })).toBe(false);
  });

  it('keeps P2 above 0.7 default', () => {
    expect(passesConfidenceFloor({ severity: 'P2', confidence: 0.7 })).toBe(true);
    expect(passesConfidenceFloor({ severity: 'P2', confidence: 0.69 })).toBe(false);
  });

  it('respects env override', () => {
    process.env.CONFIDENCE_FLOOR_P1 = '0.9';
    expect(passesConfidenceFloor({ severity: 'P1', confidence: 0.85 })).toBe(false);
    expect(passesConfidenceFloor({ severity: 'P1', confidence: 0.95 })).toBe(true);
  });
});

describe('filterByConfidence', () => {
  it('drops below-floor items', () => {
    const items = [
      { severity: 'P0' as const, confidence: 0.5 },
      { severity: 'P0' as const, confidence: 0.7 },
      { severity: 'P2' as const, confidence: 0.69 },
    ];
    const out = filterByConfidence(items);
    expect(out).toHaveLength(1);
    expect(out[0]?.confidence).toBe(0.7);
  });
});
