// Shared types for aiEditOrchestrator extension (Sprint 175).
// Follows the cardChat/types.ts and aiContext/types.ts patterns.

import type { EditRunStatus, EditStepName } from '../common/config';

/** DB row for card_ai_edit_runs. */
export interface EditRun {
  id: string;
  card_id: string;
  workspace_id: string;
  created_by: string;
  status: EditRunStatus;
  snapshot_id: string | null;
  file_scope_plan: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  /** Human-in-the-loop approval status — set after COMMITTED. */
  approval_status: ApprovalStatus | null;
}

/** Human-in-the-loop approval states for an edit run. */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** DB row for card_ai_edit_steps. */
export interface EditStep {
  id: string;
  run_id: string;
  step_name: EditStepName;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  attempt: number;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** Input for creating a new edit run. */
export interface CreateEditRunInput {
  cardId: string;
  workspaceId: string;
  userId: string;
  intent: string;
  snapshotId?: string;
}

/** Result from createEditRun. */
export interface CreateEditRunResult {
  status: 201;
  data: {
    run: EditRun;
  };
}

/** Input to advanceState. */
export interface AdvanceStateInput {
  run: EditRun;
  nextStatus: EditRunStatus;
  errorMessage?: string;
}

/** Result from a step execution — used by the orchestrator pipeline. */
export interface EditStepResult {
  status: number;
  name?: string;
  data?: Record<string, unknown>;
  message?: string;
}

/** Shape of the POST /ai/edit request body. */
export interface EditRequestInput {
  intent: string;
  /** Optional: reuse a pre-gathered context snapshot. */
  snapshotId?: string;
}

/** Response shape for POST /api/v1/cards/:cardId/ai/edit. */
export interface EditResponse {
  status: number;
  data?: {
    run: EditRun;
  };
  name?: string;
  message?: string;
}

/** Output from the path guard validation. */
export interface PathGuardResult {
  /** Whether the path is within allowed directories. */
  allowed: boolean;
  /** Normalised absolute path after resolving relative refs. */
  normalisedPath: string;
  /** If not allowed, the reason for rejection. */
  reason?: string;
}

/** Input for creating a new file through the orchestrator. */
export interface CreateFileInput {
  /** Relative path within the repo. */
  filePath: string;
  /** Full file content including optional front-matter. */
  content: string;
}

/** Result from file creation. */
export interface CreateFileResult {
  status: number;
  name?: string;
  data?: { filePath: string; created: boolean };
  message?: string;
}

/** Input for editing an existing file. */
export interface EditFileInput {
  /** Relative path within the repo. */
  filePath: string;
  /** The content to replace. May be empty for appending. */
  search: string;
  /** The replacement content. */
  replace: string;
  /** Optional: line range to constrain the edit within. */
  lineRange?: { startLine?: number; endLine?: number };
}

/** Result from file editing. */
export interface EditFileResult {
  status: number;
  name?: string;
  data?: { filePath: string; applied: boolean; changes?: string };
  message?: string;
}

/** Result from YAML front-matter validation. */
export interface FrontMatterGuardResult {
  /** Whether front-matter is valid. */
  valid: boolean;
  /** Parsed front-matter object (if valid). */
  parsed?: Record<string, unknown>;
  /** The original front-matter string (for preservation). */
  original?: string;
  /** If invalid, the reason. */
  reason?: string;
}

/** Input for the commit step. */
export interface CommitInput {
  runId: string;
  cardId: string;
  /** Files that were touched in this run. */
  touchedFiles: string[];
  /** Commit message (e.g. "feat(ai-edit): add OAuth support [card-abc] [REVIEW]"). */
  message: string;
  /** Whether to push after commit. */
  push?: boolean;
}

/** Result from the commit step. */
export interface CommitResult {
  status: number;
  name?: string;
  data?: { commitHash: string; files: string[] };
  message?: string;
}

/** Input for resuming a failed run. */
export interface ResumeInput {
  runId: string;
  /** Maximum retry attempts per step (defaults to MAX_RETRY_ATTEMPTS). */
  maxRetries?: number;
}

/** Result from resuming a failed run. */
export interface ResumeResult {
  status: number;
  name?: string;
  data?: { run: EditRun; steps: EditStep[] };
  message?: string;
}

/** Approval input. */
export interface ApprovalInput {
  runId: string;
  /** Optional: reviewer comment. */
  comment?: string;
}

/** Rejection input. */
export interface RejectionInput {
  runId: string;
  /** Required reason for rejection. */
  reason: string;
}

/** Approval/rejection result. */
export interface ApprovalResult {
  status: number;
  name?: string;
  data?: { run: EditRun };
  message?: string;
}

/** The orchestrator pipeline step order. */
export type PipelineStep =
  | 'context_gather'
  | 'file_scope_plan'
  | 'files_create'
  | 'files_edit'
  | 'commit';

/** Map from pipeline step to the corresponding run status. */
export const STEP_TO_STATUS: Record<PipelineStep, EditRunStatus> = {
  context_gather: 'CONTEXT_GATHERED' as EditRunStatus,
  file_scope_plan: 'FILE_SCOPE_PLANNED' as EditRunStatus,
  files_create: 'FILES_CREATED' as EditRunStatus,
  files_edit: 'FILES_EDITED' as EditRunStatus,
  commit: 'COMMITTED' as EditRunStatus,
};

/** Ordered list of pipeline steps. */
export const PIPELINE_STEPS: PipelineStep[] = [
  'context_gather',
  'file_scope_plan',
  'files_create',
  'files_edit',
  'commit',
];
