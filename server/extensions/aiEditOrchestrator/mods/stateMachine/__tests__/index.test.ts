// Unit tests for AI Edit Orchestrator state machine.
import { describe, it, expect } from 'vitest';
import { validateTransition, advanceState } from '../index';
import { EditRunStatus } from '../../../common/config';
import type { EditRun } from '../../../types';

function makeRun(overrides: Partial<EditRun> = {}): EditRun {
  return {
    id: 'run-1',
    card_id: 'card-1',
    workspace_id: 'ws-1',
    created_by: 'user-1',
    status: EditRunStatus.REQUESTED,
    snapshot_id: null,
    file_scope_plan: null,
    error_message: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}

describe('validateTransition', () => {
  it('allows REQUESTED → CONTEXT_GATHERED', () => {
    const result = validateTransition({
      run: makeRun({ status: EditRunStatus.REQUESTED }),
      nextStatus: EditRunStatus.CONTEXT_GATHERED,
    });
    expect(result.valid).toBe(true);
  });

  it('allows CONTEXT_GATHERED → FILE_SCOPE_PLANNED', () => {
    const result = validateTransition({
      run: makeRun({ status: EditRunStatus.CONTEXT_GATHERED }),
      nextStatus: EditRunStatus.FILE_SCOPE_PLANNED,
    });
    expect(result.valid).toBe(true);
  });

  it('allows FILE_SCOPE_PLANNED → FILES_CREATED', () => {
    const result = validateTransition({
      run: makeRun({ status: EditRunStatus.FILE_SCOPE_PLANNED }),
      nextStatus: EditRunStatus.FILES_CREATED,
    });
    expect(result.valid).toBe(true);
  });

  it('allows FILES_CREATED → FILES_EDITED', () => {
    const result = validateTransition({
      run: makeRun({ status: EditRunStatus.FILES_CREATED }),
      nextStatus: EditRunStatus.FILES_EDITED,
    });
    expect(result.valid).toBe(true);
  });

  it('allows FILES_EDITED → COMMITTED', () => {
    const result = validateTransition({
      run: makeRun({ status: EditRunStatus.FILES_EDITED }),
      nextStatus: EditRunStatus.COMMITTED,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects REQUESTED → FILES_CREATED (skip)', () => {
    const result = validateTransition({
      run: makeRun({ status: EditRunStatus.REQUESTED }),
      nextStatus: EditRunStatus.FILES_CREATED,
    });
    expect(result.valid).toBe(false);
    expect(result).toHaveProperty('name', 'invalid-state-transition');
  });

  it('rejects REQUESTED → COMMITTED (skip all)', () => {
    const result = validateTransition({
      run: makeRun({ status: EditRunStatus.REQUESTED }),
      nextStatus: EditRunStatus.COMMITTED,
    });
    expect(result.valid).toBe(false);
    expect(result).toHaveProperty('name', 'invalid-state-transition');
  });

  it('allows any non-terminal state → FAILED', () => {
    const states = [
      EditRunStatus.REQUESTED,
      EditRunStatus.CONTEXT_GATHERED,
      EditRunStatus.FILE_SCOPE_PLANNED,
      EditRunStatus.FILES_CREATED,
      EditRunStatus.FILES_EDITED,
    ];
    for (const status of states) {
      const result = validateTransition({
        run: makeRun({ status }),
        nextStatus: EditRunStatus.FAILED,
      });
      expect(result.valid).toBe(true);
    }
  });

  it('rejects COMMITTED → any (terminal)', () => {
    const result = validateTransition({
      run: makeRun({ status: EditRunStatus.COMMITTED }),
      nextStatus: EditRunStatus.FILES_EDITED,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects FAILED → any (terminal)', () => {
    const result = validateTransition({
      run: makeRun({ status: EditRunStatus.FAILED }),
      nextStatus: EditRunStatus.REQUESTED,
    });
    expect(result.valid).toBe(false);
  });
});

describe('advanceState', () => {
  it('advances REQUESTED → CONTEXT_GATHERED', () => {
    const run = makeRun({ status: EditRunStatus.REQUESTED });
    const advanced = advanceState({ run, nextStatus: EditRunStatus.CONTEXT_GATHERED });
    expect(advanced.status).toBe(EditRunStatus.CONTEXT_GATHERED);
    expect(advanced.updated_at).not.toBe(run.updated_at);
    expect(advanced.completed_at).toBeNull(); // not terminal
  });

  it('advances FILES_EDITED → COMMITTED and sets completed_at', () => {
    const run = makeRun({ status: EditRunStatus.FILES_EDITED });
    const advanced = advanceState({ run, nextStatus: EditRunStatus.COMMITTED });
    expect(advanced.status).toBe(EditRunStatus.COMMITTED);
    expect(advanced.completed_at).not.toBeNull();
  });

  it('advances to FAILED with error message', () => {
    const run = makeRun({ status: EditRunStatus.FILE_SCOPE_PLANNED });
    const advanced = advanceState({
      run,
      nextStatus: EditRunStatus.FAILED,
      errorMessage: 'File creation timed out',
    });
    expect(advanced.status).toBe(EditRunStatus.FAILED);
    expect(advanced.error_message).toBe('File creation timed out');
    expect(advanced.completed_at).not.toBeNull();
  });

  it('preserves existing error_message when advancing to FAILED without a new one', () => {
    const run = makeRun({
      status: EditRunStatus.CONTEXT_GATHERED,
      error_message: 'Prior error',
    });
    const advanced = advanceState({ run, nextStatus: EditRunStatus.FAILED });
    expect(advanced.status).toBe(EditRunStatus.FAILED);
    expect(advanced.error_message).toBe('Prior error');
  });
});
