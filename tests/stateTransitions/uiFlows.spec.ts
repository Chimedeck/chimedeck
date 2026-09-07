import { describe, expect, it } from 'bun:test';
import {
  getStateTransitionErrorBodyText,
  normalizeAllowedNextStates,
} from '../../src/extensions/StateTransitions/components/StateTransitionErrorPopup';
import { extractStateTransitionRejectionFromError } from '../../src/extensions/StateTransitions/components/KanbanCard';
import {
  buildStateTransitionGuardSnapshot,
  getAllowedNextStatesWithSnapshot,
  isListLockedWithSnapshot,
} from '../../src/extensions/StateTransitions/hooks/useStateTransitionGuard';

describe('state transition UI flow helpers', () => {
  it('normalizes allowed next states list for popup rendering', () => {
    const normalized = normalizeAllowedNextStates([
      { id: 'list-2', name: 'In Review' },
      { id: 'list-2', name: 'Duplicate entry' },
      { id: 'list-3', name: '  ' },
    ]);

    expect(normalized).toEqual([
      { id: 'list-2', name: 'In Review' },
      { id: 'list-3', name: 'list-3' },
    ]);
  });

  it('returns locked-column popup text when no allowed states exist', () => {
    const bodyText = getStateTransitionErrorBodyText({
      fromListId: 'list-1',
      fromListName: 'In Progress',
      toListId: 'list-2',
      toListName: 'Done',
      allowedNextStates: [],
    });
    expect(bodyText).toBe(
      'Cards in "In Progress" cannot be moved anywhere — this column has no allowed transitions.',
    );
  });

  it('extracts race-condition 422 payload into a rejection model for rollback popup', () => {
    const parsed = extractStateTransitionRejectionFromError({
      error: {
        response: {
          status: 422,
          data: {
            name: 'state-transition-forbidden',
            data: {
              fromListId: 'list-1',
              fromListName: 'Todo',
              toListId: 'list-3',
              toListName: 'Done',
              allowedNextStates: [
                { id: 'list-2', name: 'Doing' },
              ],
            },
          },
        },
      },
      fallback: {
        fromListId: 'fallback-from',
        fromListName: 'Fallback from',
        toListId: 'fallback-to',
        toListName: 'Fallback to',
      },
    });

    expect(parsed).toEqual({
      fromListId: 'list-1',
      fromListName: 'Todo',
      toListId: 'list-3',
      toListName: 'Done',
      allowedNextStates: [{ id: 'list-2', name: 'Doing' }],
    });
  });

  it('derives locked-column indicator and allowed states from guard snapshot', () => {
    const snapshot = buildStateTransitionGuardSnapshot({
      stateTransitionsFeatureEnabled: true,
      boardEnforced: true,
      rules: [
        {
          currentState: 'Todo',
          currentStateId: 'list-1',
          allowedNextStates: ['Doing'],
          allowedNextStateIds: ['list-2'],
          forbiddenNextStates: ['Done'],
          forbiddenNextStateIds: ['list-3'],
        },
      ],
      knownLists: [
        { id: 'list-1', title: 'Todo' },
        { id: 'list-2', title: 'Doing' },
        { id: 'list-3', title: 'Done' },
      ],
    });

    expect(getAllowedNextStatesWithSnapshot(snapshot, 'list-1')).toEqual([
      { id: 'list-2', name: 'Doing' },
    ]);
    expect(isListLockedWithSnapshot(snapshot, 'list-1')).toBe(false);
    expect(isListLockedWithSnapshot(snapshot, 'list-3')).toBe(true);
  });
});
