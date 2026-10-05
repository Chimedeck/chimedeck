// Sprint 175 — AI Edit Orchestrator state machine.
// [why] Enforces allowed transitions via a lookup map, rejecting any
// attempt to skip steps or transition from a terminal state.
// Pattern borrowed from cardChat/mods/session/lifecycle.ts.

import { EditRunStatus } from '../../common/config';
import type { EditRunStatus as EditRunStatusType } from '../../common/config';
import type { EditRun, AdvanceStateInput } from '../../types';

/**
 * Allowed transitions map — defines which statuses can follow which.
 * REQUESTED → CONTEXT_GATHERED → FILE_SCOPE_PLANNED → FILES_CREATED →
 * FILES_EDITED → COMMITTED. Any non-terminal state can transition to FAILED.
 * COMMITTED and FAILED are terminal.
 */
const ALLOWED_TRANSITIONS: Record<EditRunStatusType, EditRunStatusType[]> = {
  [EditRunStatus.REQUESTED]: [EditRunStatus.CONTEXT_GATHERED, EditRunStatus.FAILED],
  [EditRunStatus.CONTEXT_GATHERED]: [EditRunStatus.FILE_SCOPE_PLANNED, EditRunStatus.FAILED],
  [EditRunStatus.FILE_SCOPE_PLANNED]: [EditRunStatus.FILES_CREATED, EditRunStatus.FAILED],
  [EditRunStatus.FILES_CREATED]: [EditRunStatus.FILES_EDITED, EditRunStatus.FAILED],
  [EditRunStatus.FILES_EDITED]: [EditRunStatus.COMMITTED, EditRunStatus.FAILED],
  [EditRunStatus.COMMITTED]: [EditRunStatus.FAILED], // terminal
  [EditRunStatus.FAILED]: [], // terminal
};

/**
 * Validate that a transition from currentStatus to nextStatus is allowed.
 * Returns null on success, or an error object on invalid transition.
 */
export function validateTransition({
  run,
  nextStatus,
}: AdvanceStateInput): { valid: true } | { valid: false; name: string; message: string } {
  const allowed = ALLOWED_TRANSITIONS[run.status];

  if (!allowed || allowed.length === 0) {
    return {
      valid: false,
      name: 'invalid-state-transition',
      message: `Status ${run.status} is terminal — no further transitions allowed`,
    };
  }

  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      name: 'invalid-state-transition',
      message: `Cannot transition from ${run.status} to ${nextStatus}. Allowed: [${allowed.join(', ')}]`,
    };
  }

  return { valid: true };
}

/**
 * Compute the output run object after advancing state.
 * Does NOT persist — that's the responsibility of the persistence module.
 */
export function advanceState(input: AdvanceStateInput): EditRun {
  const { run, nextStatus, errorMessage } = input;

  const now = new Date().toISOString();
  const isTerminal = nextStatus === EditRunStatus.COMMITTED || nextStatus === EditRunStatus.FAILED;

  return {
    ...run,
    status: nextStatus,
    updated_at: now,
    completed_at: isTerminal ? now : run.completed_at,
    error_message:
      nextStatus === EditRunStatus.FAILED ? (errorMessage ?? run.error_message) : run.error_message,
  };
}

export const stateMachineDeps = {
  validateTransition,
  advanceState,
};
