// Central config for aiEditOrchestrator extension (Sprint 175).
// [why] All env vars, limits, and constants are read here so the full
// configuration surface is visible in one place.
export const AI_EDIT_FLAG_KEY = 'AI_EDIT_ENABLED';

/** Allowed write paths for the AI edit orchestrator — writes outside these
    paths are rejected by the path guard (Iteration 11). */
export const ALLOWED_PATHS = [
  'specs/request_changelog/',
  'specs/sprints/',
  'specs/architecture/',
  'specs/security/',
] as const;

/** Max retry attempts per step before marking the step as FAILED. */
export const MAX_RETRY_ATTEMPTS = 3;

/** Commit message template for orchestrator commits. */
export const COMMIT_MESSAGE_TEMPLATE = 'feat(ai-edit): {intent} [{cardId}] [REVIEW]';

/** Commit message template for post-approval merge commits. */
export const APPROVED_COMMIT_MESSAGE_TEMPLATE = 'feat(ai-edit): {intent} [{cardId}] [APPROVED]';

/**
 * Edit run status enum — linear progression with FAILED as an escape hatch
 * from any non-terminal state.
 */
export const EditRunStatus = {
  REQUESTED: 'REQUESTED',
  CONTEXT_GATHERED: 'CONTEXT_GATHERED',
  FILE_SCOPE_PLANNED: 'FILE_SCOPE_PLANNED',
  FILES_CREATED: 'FILES_CREATED',
  FILES_EDITED: 'FILES_EDITED',
  COMMITTED: 'COMMITTED',
  FAILED: 'FAILED',
} as const;

export type EditRunStatus = (typeof EditRunStatus)[keyof typeof EditRunStatus];

/**
 * Step names in the edit pipeline — executed in order.
 */
export const EditStepName = {
  CONTEXT_GATHER: 'context_gather',
  FILE_SCOPE_PLAN: 'file_scope_plan',
  FILES_CREATE: 'files_create',
  FILES_EDIT: 'files_edit',
  COMMIT: 'commit',
} as const;

export type EditStepName = (typeof EditStepName)[keyof typeof EditStepName];
