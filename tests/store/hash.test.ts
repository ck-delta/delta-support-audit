import { describe, it, expect } from 'vitest';
import { sha256, hashKey, diff } from '@/lib/store/hash';

describe('sha256', () => {
  it('is deterministic', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
  });
  it('produces a 64-char hex string', () => {
    expect(sha256('x')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('is sensitive to whitespace and case', () => {
    expect(sha256('hello')).not.toBe(sha256('Hello'));
    expect(sha256('hello')).not.toBe(sha256('hello '));
  });
});

describe('hashKey', () => {
  it('formats as hash:<source>:<stableId>', () => {
    expect(hashKey('guides', 'trading-guide/leverage')).toBe(
      'hash:guides:trading-guide/leverage',
    );
    expect(hashKey('support_freshdesk', '80001014604')).toBe(
      'hash:support_freshdesk:80001014604',
    );
  });
});

describe('diff', () => {
  const now = '2026-04-27T00:00:00.000Z';

  it('marks new entries as changed=true, isNew=true', () => {
    const r = diff(null, 'abc', now);
    expect(r.changed).toBe(true);
    expect(r.isNew).toBe(true);
    expect(r.next.lastChanged).toBe(now);
  });

  it('marks unchanged entries as changed=false', () => {
    const prev = { sha256: 'abc', lastSeen: '2026-01-01', lastChanged: '2026-01-01' };
    const r = diff(prev, 'abc', now);
    expect(r.changed).toBe(false);
    expect(r.isNew).toBe(false);
    expect(r.next.sha256).toBe('abc');
    expect(r.next.lastSeen).toBe(now);
    expect(r.next.lastChanged).toBe('2026-01-01');
  });

  it('marks updated entries as changed=true, isNew=false', () => {
    const prev = { sha256: 'old', lastSeen: '2026-01-01', lastChanged: '2026-01-01' };
    const r = diff(prev, 'new', now);
    expect(r.changed).toBe(true);
    expect(r.isNew).toBe(false);
    expect(r.next.sha256).toBe('new');
    expect(r.next.lastChanged).toBe(now);
  });
});
