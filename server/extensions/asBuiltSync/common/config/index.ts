// As-Built Sync extension config (Sprint 176).
// [why] All feature flags, allowed write paths, and constants are centralised
// here so the full configuration surface is visible in one place. Follows the
// sprintGeneration/common/config pattern.

/** Feature flag key gating the as-built sync feature. */
export const AS_BUILT_SYNC_FLAG_KEY = 'AS_BUILT_SYNC_ENABLED';

/**
 * Allowed write paths for as-built sync updates.
 * [why] Restricts doc updates to architecture, security, and changelog paths
 * only — matches the ALLOWED_PATHS used by aiEditOrchestrator's pathGuard.
 */
export const ALLOWED_OUTPUT_PATHS = [
  'specs/architecture/',
  'specs/security/',
  'specs/request_changelog/',
] as const;

/** Maximum retry attempts for the as-built sync pipeline. */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * As-built sync run status enum — linear progression with FAILED as escape hatch.
 * Same shape as SprintGenRunStatus for consistency across the codebase.
 */
export const AsBuiltSyncRunStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;

export type AsBuiltSyncRunStatus = (typeof AsBuiltSyncRunStatus)[keyof typeof AsBuiltSyncRunStatus];

/** Commit message template for as-built sync commits. */
export const COMMIT_MESSAGE_TEMPLATE = 'docs(as-built): sync implementation evidence for card {cardId} [AS-BUILT]';
