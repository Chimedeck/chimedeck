import { describe, expect, it } from 'bun:test';
import {
  StateTransitionForbiddenError,
  stateTransitionError,
  stateTransitionRulesError,
  stateTransitionSyncError,
} from '../errors';

describe('stateTransitions errors', () => {
  it('creates generic state transition errors with name and data', () => {
    expect(stateTransitionError('state-transition-graph-invalid', { message: 'invalid graph' })).toEqual({
      name: 'state-transition-graph-invalid',
      data: { message: 'invalid graph' },
    });
  });

  it('creates sync and rules-specific error envelopes', () => {
    expect(stateTransitionSyncError({ boardId: 'board-1' })).toEqual({
      name: 'state-transition-sync-failed',
      data: { boardId: 'board-1' },
    });
    expect(stateTransitionRulesError({ boardId: 'board-1' })).toEqual({
      name: 'state-transition-rules-invalid',
      data: { boardId: 'board-1' },
    });
  });

  it('captures forbidden move context and clones allowedNextStates defensively', () => {
    const allowed = [{ id: 'list-2', name: 'Doing' }];
    const error = new StateTransitionForbiddenError({
      boardId: 'board-1',
      fromListId: 'list-1',
      fromListName: 'Todo',
      toListId: 'list-3',
      toListName: 'Done',
      allowedNextStates: allowed,
    });

    allowed[0]!.name = 'MUTATED';

    expect(error.name).toBe('StateTransitionForbiddenError');
    expect(error.allowedNextStates).toEqual([{ id: 'list-2', name: 'Doing' }]);
  });
});
