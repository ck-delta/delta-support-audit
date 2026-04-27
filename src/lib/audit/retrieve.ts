import { retrieveTopK } from '@/lib/store/vector.js';
import type { Article, RetrievedChunk } from '@/lib/types.js';

export interface RetrievedSot {
  guides: RetrievedChunk[];
  docs: RetrievedChunk[];
}

export async function retrieveSotForArticle(article: Article, k = 5): Promise<RetrievedSot> {
  const query = buildQuery(article);
  const [guides, docs] = await Promise.all([
    retrieveTopK(query, k, { sourceFilter: 'guides' }),
    retrieveTopK(query, k, { sourceFilter: 'docs' }),
  ]);
  return { guides, docs };
}

function buildQuery(article: Article): string {
  const head = article.text.slice(0, 1500).trim();
  return article.title ? `${article.title}\n\n${head}` : head;
}

export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '(none retrieved)\n';
  return chunks
    .map((c, i) => {
      const heading = c.metadata.sectionHeading || c.metadata.articleTitle || '';
      const url = c.metadata.articleUrl || '';
      return [
        `[chunk ${i + 1}] score=${c.score.toFixed(3)}`,
        `heading: ${heading}`,
        `url: ${url}`,
        `text:`,
        c.data.trim(),
      ].join('\n');
    })
    .join('\n\n---\n\n');
}
