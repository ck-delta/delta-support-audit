import * as cheerio from 'cheerio';
import type { Source, NormalizedDoc, Heading } from '@/lib/types';

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'li',
  'tr',
  'br',
  'section',
  'article',
  'pre',
  'blockquote',
]);

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

interface SourceProfile {
  rootSelector: string;
  stripSelectors: string[];
}

const PROFILES: Record<Source, SourceProfile> = {
  guides: {
    rootSelector: 'main',
    stripSelectors: [
      'nav',
      'aside',
      'header',
      'footer',
      'script',
      'style',
      'noscript',
      'svg',
      '[data-testid="page-toc"]',
      '[aria-label="On this page"]',
      'button',
    ],
  },
  docs: {
    rootSelector: 'body',
    stripSelectors: ['script', 'style', 'noscript', '#search', '.toc'],
  },
  support_freshdesk: {
    rootSelector: 'article, .article-body, body',
    stripSelectors: [
      'nav',
      'header',
      'footer',
      'script',
      'style',
      'noscript',
      'svg',
      'button',
      '#sidebar',
      '.help-article-header',
      '.related-articles',
      '.article-feedback',
      '.cookie-consent',
      '.breadcrumb',
    ],
  },
};

export function normalize(html: string, source: Source): NormalizedDoc {
  const $ = cheerio.load(html);
  const profile = PROFILES[source];

  // Always remove these — script/style content corrupts hashing
  $('script, style, noscript, svg').remove();
  for (const sel of profile.stripSelectors) $(sel).remove();

  let $root = $(profile.rootSelector).first();
  if ($root.length === 0) $root = $('body').first();
  if ($root.length === 0) $root = $.root();

  const title = $('title').first().text().trim() || $root.find('h1').first().text().trim() || '';

  const headings: Heading[] = [];
  $root.find(HEADING_TAGS.join(',')).each((_, el) => {
    const level = Number(el.tagName.slice(1));
    const text = $(el).text().trim();
    if (!text) return;
    const id = $(el).attr('id') ?? undefined;
    headings.push({ level, text, id });
  });

  const text = extractText($, $root);
  return { title, text, headings };
}

function extractText($: cheerio.CheerioAPI, $root: cheerio.Cheerio<any>): string {
  const out: string[] = [];

  function walk(node: any): void {
    if (node.type === 'text') {
      const t = (node.data ?? '').replace(/\s+/g, ' ');
      if (t) out.push(t);
      return;
    }
    if (node.type !== 'tag') return;
    const tag = node.name?.toLowerCase();
    if (tag && BLOCK_TAGS.has(tag) && out.length > 0 && !out[out.length - 1]?.endsWith('\n')) {
      out.push('\n');
    }
    if (HEADING_TAGS.includes(tag as (typeof HEADING_TAGS)[number])) {
      if (out.length > 0) out.push('\n\n');
    }
    for (const child of node.children ?? []) walk(child);
    if (tag && BLOCK_TAGS.has(tag)) out.push('\n');
    if (HEADING_TAGS.includes(tag as (typeof HEADING_TAGS)[number])) out.push('\n');
  }

  $root.each((_, el) => walk(el));

  return out
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
