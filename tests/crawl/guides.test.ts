import { describe, it, expect } from 'vitest';
import { stableIdFromUrl } from '@/lib/crawl/guides';

describe('guides stableIdFromUrl', () => {
  it('returns the path after the user-guide root', () => {
    expect(
      stableIdFromUrl(
        'https://guides.delta.exchange/delta-exchange-india-user-guide/trading-guide/leverage',
      ),
    ).toBe('trading-guide/leverage');
  });

  it('handles trailing slash', () => {
    expect(
      stableIdFromUrl(
        'https://guides.delta.exchange/delta-exchange-india-user-guide/derivatives-guide/options-guide/',
      ),
    ).toBe('derivatives-guide/options-guide');
  });

  it('returns "index" for the root', () => {
    expect(stableIdFromUrl('https://guides.delta.exchange/delta-exchange-india-user-guide')).toBe(
      'index',
    );
  });

  it('falls back to the URL itself for unexpected hosts', () => {
    expect(stableIdFromUrl('https://example.com/foo')).toBe('https://example.com/foo');
  });
});
