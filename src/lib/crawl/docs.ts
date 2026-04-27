import * as cheerio from 'cheerio';
import type { Element, AnyNode } from 'domhandler';
import { fetchText } from './fetch.js';
import type { Article } from '@/lib/types.js';

const DOCS_URL = 'https://docs.delta.exchange/';

export async function* crawl(): AsyncGenerator<Article> {
  const html = await fetchText(DOCS_URL);
  yield* chunk(html);
}

export function* chunk(html: string): Generator<Article> {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();

  const $headings = $('h2, h3').toArray();
  if ($headings.length === 0) return;

  const seen = new Map<string, number>();
  for (let i = 0; i < $headings.length; i++) {
    const el = $headings[i]!;
    const $h = $(el);
    const headingText = $h.text().trim();
    if (!headingText) continue;
    const baseId = $h.attr('id') ?? slugify(headingText);
    const seenCount = seen.get(baseId) ?? 0;
    seen.set(baseId, seenCount + 1);
    const id = seenCount === 0 ? baseId : `${baseId}-${seenCount + 1}`;
    const sectionText = collectUntilNext($, el, $headings, i);
    if (sectionText.length < 30) continue;

    yield {
      source: 'docs',
      stableId: id,
      url: `${DOCS_URL}#${id}`,
      title: headingText,
      text: sectionText,
      html: '',
    };
  }
}

function collectUntilNext(
  $: cheerio.CheerioAPI,
  startEl: Element,
  allHeadings: Element[],
  startIndex: number,
): string {
  const startLevel = Number(startEl.tagName.slice(1));
  const stopAt = new Set<Element>();
  for (let j = startIndex + 1; j < allHeadings.length; j++) {
    const el = allHeadings[j]!;
    const lvl = Number(el.tagName.slice(1));
    if (lvl <= startLevel) {
      stopAt.add(el);
      break;
    }
  }
  const buf: string[] = [$(startEl).text().trim()];
  let node: AnyNode | null = startEl.nextSibling;
  while (node) {
    if (node.type === 'tag') {
      if (stopAt.has(node as Element)) break;
      const t = $(node as Element).text().trim();
      if (t) buf.push(t);
    } else if (node.type === 'text') {
      const t = ((node as { data?: string }).data ?? '').trim();
      if (t) buf.push(t);
    }
    node = node.nextSibling;
  }
  return buf
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
