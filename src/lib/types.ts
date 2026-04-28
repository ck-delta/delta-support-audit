export type Source = 'guides' | 'docs' | 'support';

export const SOURCES: readonly Source[] = ['guides', 'docs', 'support'] as const;

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

export interface ConflictIssue {
  id: string;
  severity: Severity;
  guidesQuote: string;
  guidesUrl: string;
  docsQuote: string;
  docsUrl: string;
  summary: string;
  confidence: number;
  status: 'new' | 'still-open' | 'resolved';
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface CoverageIssue {
  id: string;
  severity: Severity;
  sotSource: 'guides' | 'docs';
  sotUrl: string;
  sotText: string;
  closestSupportUrl?: string;
  similarity: number;
  missingAspects: string[];
  suggestedSupportTopic: string;
  suggestedOwner: SuggestedOwner;
  summary: string;
  confidence: number;
  status: 'new' | 'still-open' | 'resolved';
  firstSeenAt: string;
  lastSeenAt: string;
}

export type DedupStatus = 'new' | 'still-open' | 'resolved';

export interface RunMetadata {
  startedAt: string;
  completedAt: string;
  model: string;
  articlesChecked: number;
  articlesChanged: number;
  articlesAudited: number;
  totalIssues: number;
  newIssues: number;
  stillOpenIssues: number;
  resolvedIssues: number;
  totalConflicts: number;
  totalCoverageGaps: number;
  promptTokens: number;
  completionTokens: number;
  costEstimateUsd: number;
  truncated: boolean;
  durationMs: number;
  errors: number;
}

export interface AuditReport {
  metadata: RunMetadata;
  issuesBySeverity: { P0: Issue[]; P1: Issue[]; P2: Issue[] };
  conflicts: ConflictIssue[];
  coverageGaps: CoverageIssue[];
}
