// Shared types for aiContext extension (Sprint 174).
// Follows the cardChat types.ts pattern: enums, DB entities, input/output, domain types.

/** Sources from which context chunks can originate. */
export type ContextSource = 'docs' | 'code' | 'cards' | 'git';

/** A single search result from one connector, before ranking. */
export interface SearchConnectorResult {
  /** Machine-readable source type. */
  source: ContextSource;
  /** Human-readable label for attribution (e.g. "specs/architecture/plugins.md"). */
  sourcePath: string;
  /** The matched content chunk (truncated if over limit). */
  content: string;
  /** Relevance score 0-1 from the connector's own scoring. */
  relevance: number;
  /** Additional connector-specific metadata. */
  metadata?: Record<string, unknown>;
}

/** A ranked, deduplicated context chunk ready for the caller. */
export interface ContextChunk {
  source: ContextSource;
  sourcePath: string;
  content: string;
  /** Normalised confidence score 0-1 after ranking. */
  confidence: number;
  /** Line range if source is a file (e.g. { start: 10, end: 25 }). */
  lineRange?: { start: number; end: number };
  /** Whether content was truncated due to size limits. */
  truncated?: boolean;
}

/** Input to the gather endpoint. */
export interface ContextGatherInput {
  /** The card ID to gather context for. */
  cardId: string;
  /** User's intent description to help relevance scoring. */
  intent: string;
  /** Optional list of paths to focus the search on. Must be within allowlist. */
  focusPaths?: string[];
}

/** Response shape for POST /api/v1/cards/:cardId/ai/context/gather. */
export interface ContextGatherResponse {
  /** Ranked, deduplicated context chunks. */
  chunks: ContextChunk[];
  /** Count of results per source for transparency. */
  sourceCounts: Record<ContextSource, number>;
  /** Total chunks returned (may be less than total found due to budget). */
  totalReturned: number;
  /** Whether any connector timed out. */
  timeouts: ContextSource[];
  /** Snapshot ID for traceability — persisted alongside gather result. */
  snapshotId?: string;
  /** Budget consumption report. */
  budget?: BudgetReport;
}

/** Shape of a path allowlist rule. */
export interface PathAllowlistEntry {
  /** Glob pattern. */
  pattern: string;
  /** Reason this path is allowed — for audit logging. */
  reason: string;
}

/** Result from the gather pipeline before HTTP serialisation. */
export interface GatherPipelineResult {
  status: number;
  name?: string;
  message?: string;
  data?: ContextGatherResponse;
}

// ── Sprint 174 Part 2: Budget, Duplicate Detection, Impact, File Scope, Snapshots ──

/** Budget consumption for a single gather call. */
export interface BudgetReport {
  totalTokens: number;
  maxTokens: number;
  totalSizeBytes: number;
  maxSizeBytes: number;
  /** Whether either budget was exceeded (chunks were truncated). */
  exceeded: boolean;
  /** Number of chunks dropped due to budget limits. */
  droppedChunks: number;
}

/** A file-plan decision returned by the file scope planner. */
export type FileDecision = 'create' | 'edit' | 'no-change';

/** Single entry in the file scope plan. */
export interface FileScopeEntry {
  /** Relative path to the file within the repo. */
  filePath: string;
  /** What should happen to this file. */
  decision: FileDecision;
  /** Human-readable rationale for the decision. */
  rationale: string;
  /** Confidence 0-1 in the decision. */
  confidence: number;
  /** Suggested content hint for new files (only when decision is "create"). */
  contentHint?: string;
  /** Lines to edit for existing files (only when decision is "edit"). */
  editHint?: { startLine?: number; endLine?: number; snippet?: string };
}

/** Input to the file scope planner API. */
export interface FileScopeInput {
  cardId: string;
  intent: string;
  /** Optional: reuse a previously gathered context snapshot ID. */
  snapshotId?: string;
}

/** Response from POST /api/v1/cards/:cardId/ai/file-scope. */
export interface FileScopeResponse {
  /** Ordered list of file decisions (create before edit). */
  files: FileScopeEntry[];
  /** Detected duplicate cards (may overlap with this card's intent). */
  possibleDuplicateCards: DuplicateCard[];
  /** Files likely impacted based on changed entities. */
  likelyImpactedFiles: string[];
  /** Overall confidence in the plan (0-1). */
  confidence: number;
  /** Snapshot ID used for traceability. */
  snapshotId: string;
}

/** A card detected as potentially duplicate effort. */
export interface DuplicateCard {
  cardId: string;
  cardTitle: string;
  /** Semantic similarity score 0-1. */
  similarityScore: number;
  /** Overlap reason (e.g. "Similar title and description"). */
  reason: string;
}

/** Analysis of how a card's intent overlaps with recently changed files. */
export interface ImpactAnalysisResult {
  /** Files most likely to need changes, ranked by impact score. */
  likelyImpactedFiles: ImpactedFile[];
  /** Total overlap score with recently changed spec files (0-1). */
  overallOverlapScore: number;
}

/** A single file in the impact map. */
export interface ImpactedFile {
  filePath: string;
  /** Impact score 0-1. */
  impactScore: number;
  /** Reason this file is likely impacted. */
  reason: string;
  /** Key entities found in both the card intent and this file. */
  matchedEntities: string[];
}

/** Persisted context snapshot row in card_ai_context_snapshots. */
export interface SnapshotRecord {
  id: string;
  cardId: string;
  intent: string;
  /** Immutable SHA-256 hash of the chunks JSON for dedup/reproducibility. */
  snapshotHash: string;
  /** Total chunks in the snapshot (before budget truncation). */
  totalChunks: number;
  /** The gather response serialised as JSON. */
  chunksJson: string;
  /** Budget report at time of gather. */
  budgetJson: string;
  /** Optional focus paths used during gather. */
  focusPaths?: string[];
  createdAt: Date;
}
