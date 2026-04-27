export type Source = 'guides' | 'docs' | 'support_freshdesk';

export const SOURCES: readonly Source[] = ['guides', 'docs', 'support_freshdesk'] as const;

export interface Article {
  source: Source;
  stableId: string;
  url: string;
  title: string;
  text: string;
  html: string;
  lastModified?: string;
}

export interface Heading {
  level: number;
  text: string;
  id?: string;
}

export interface NormalizedDoc {
  title: string;
  text: string;
  headings: Heading[];
}

export interface HashRecord {
  sha256: string;
  lastSeen: string;
  lastChanged: string;
}

export type Severity = 'P0' | 'P1' | 'P2';

export type IssueType = 'contradiction' | 'conflict' | 'coverage';

export type SuggestedOwner = 'Support' | 'Docs' | 'Engineering' | 'Product';

export interface Issue {
  id: string;
  type: IssueType;
  severity: Severity;
  supportUrl?: string;
  sotUrl?: string;
  supportQuote?: string;
  sotQuote?: string;
  summary: string;
  confidence: number;
  suggestedOwner?: SuggestedOwner;
  status: 'new' | 'still-open' | 'resolved';
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ChunkMetadata {
  source: Source;
  articleStableId: string;
  articleTitle: string;
  articleUrl: string;
  sectionHeading: string;
  chunkIndex: number;
}

export interface PreparedChunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

export interface RetrievedChunk {
  id: string;
  score: number;
  data: string;
  metadata: ChunkMetadata;
}
