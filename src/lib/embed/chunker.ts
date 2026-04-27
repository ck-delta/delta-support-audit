import type { Article, ChunkMetadata, PreparedChunk } from '@/lib/types.js';

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

const DEFAULTS: Required<ChunkOptions> = { maxChars: 2000, overlap: 200 };

export function chunkArticle(article: Article, opts: ChunkOptions = {}): PreparedChunk[] {
  const { maxChars, overlap } = { ...DEFAULTS, ...opts };
  const text = (article.text ?? '').trim();
  if (text.length === 0) return [];

  const segments = splitByBoundaries(text, maxChars, overlap);
  return segments.map((seg, idx) => ({
    id: chunkId(article, idx),
    text: seg,
    metadata: buildMetadata(article, idx),
  }));
}

export function chunkId(article: Article, index: number): string {
  return `${article.source}:${article.stableId}#${index}`;
}

function buildMetadata(article: Article, chunkIndex: number): ChunkMetadata {
  return {
    source: article.source,
    articleStableId: article.stableId,
    articleTitle: article.title,
    articleUrl: article.url,
    sectionHeading: article.title,
    chunkIndex,
  };
}

export function splitByBoundaries(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n{2,}/).filter((p) => p.length > 0);
  const chunks: string[] = [];
  let buffer = '';

  const flushBuffer = (): void => {
    if (buffer.trim().length > 0) chunks.push(buffer.trim());
    buffer = '';
  };

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      flushBuffer();
      const sliced = sliceWithOverlap(para, maxChars, overlap);
      for (let i = 0; i < sliced.length - 1; i++) chunks.push(sliced[i]!.trim());
      buffer = sliced[sliced.length - 1] ?? '';
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      buffer = candidate;
      continue;
    }

    flushBuffer();
    const carry = tail(candidate.slice(0, candidate.length - para.length - 2), overlap);
    const combined = carry && carry.length + 2 + para.length <= maxChars ? `${carry}\n\n${para}` : para;
    buffer = combined;
  }

  flushBuffer();
  return chunks;
}

function tail(s: string, n: number): string {
  if (s.length <= n) return s;
  // try to start at a word boundary inside the tail window
  const slice = s.slice(s.length - n);
  const space = slice.indexOf(' ');
  return space === -1 ? slice : slice.slice(space + 1);
}

function sliceWithOverlap(text: string, maxChars: number, overlap: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + maxChars);
    out.push(text.slice(i, end));
    if (end >= text.length) break;
    i = end - overlap;
  }
  return out;
}
