// Shared types for asBuiltSync extension (Sprint 176).
// Follows the sprintGeneration/types.ts pattern.
import type { AsBuiltSyncRunStatus } from './common/config';

// ── DB entities ──

/** DB row for card_as_built_sync_runs. */
export interface AsBuiltSyncRun {
  id: string;
  card_id: string;
  workspace_id: string;
  created_by: string;
  status: AsBuiltSyncRunStatus;
  trigger_run_id: string | null;
  evidence: AsBuiltEvidence | null;
  output_files: string[] | null;
  commit_hash: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Evidence collected during the as-built sync process. */
export interface AsBuiltEvidence {
  /** Merged PR references from git log. */
  mergedPrs: Array<{
    prNumber: string;
    prTitle: string;
    mergedAt: string;
    branchName: string;
  }>;
  /** Files changed (collected from git diff of merged branches). */
  changedFiles: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted';
  }>;
  /** Test evidence found in the changed files. */
  testEvidence: Array<{
    testFile: string;
    testCount: number;
    passingCount: number;
    failingCount: number;
  }>;
  /** Card metadata at time of sync. */
  cardMetadata: {
    title: string;
    description: string;
    phase: string;
    boardId: string;
    listId: string;
  };
}

// ── Pipeline inputs / outputs ──

/** Input to the evidenceCollector step. */
export interface CollectEvidenceInput {
  cardId: string;
  workspaceId: string;
  boardId: string;
}

/** Output from the evidenceCollector step. */
export interface CollectEvidenceOutput {
  status: number;
  name?: string;
  message?: string;
  data?: {
    evidence: AsBuiltEvidence;
  };
}

/** Input to the docUpdater step. */
export interface UpdateDocsInput {
  cardId: string;
  evidence: AsBuiltEvidence;
  runId: string;
}

/** Output from the docUpdater step. */
export interface UpdateDocsOutput {
  status: number;
  name?: string;
  message?: string;
  data?: {
    updatedFiles: string[];
    changelogWritten: boolean;
  };
}

/** Input to the asBuiltSync committer step. */
export interface AsBuiltCommitInput {
  runId: string;
  cardId: string;
  touchedFiles: string[];
}

// ── Activity events ──

export type AsBuiltActivityType =
  | 'as_built_sync_started'
  | 'as_built_sync_evidence_collected'
  | 'as_built_sync_docs_updated'
  | 'as_built_sync_committed'
  | 'as_built_sync_completed'
  | 'as_built_sync_failed';

export interface AsBuiltActivityInput {
  type: AsBuiltActivityType;
  cardId: string;
  boardId: string | null;
  runId: string;
  actorId: string;
  payload?: Record<string, unknown>;
}

// ── API request/response ──

/** POST /api/v1/cards/:cardId/as-built/sync response. */
export interface AsBuiltSyncResponse {
  status: number;
  name?: string;
  message?: string;
  data?: {
    run: Omit<AsBuiltSyncRun, 'evidence'> & { evidence?: AsBuiltEvidence | null };
  };
}
