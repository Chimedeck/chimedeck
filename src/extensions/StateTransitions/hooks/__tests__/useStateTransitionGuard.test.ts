import { describe, expect, it } from 'bun:test';
import {
  buildStateTransitionGuardSnapshot,
  canMoveWithSnapshot,
  getRejectionReasonWithSnapshot,
  isListLockedWithSnapshot,
} from '../useStateTransitionGuard';

describe('useStateTransitionGuard helpers', () => {
  const knownLists = [
    { id: 'todo', title: 'Todo' },
    { id: 'doing', title: 'Doing' },
    { id: 'done', title: 'Done' },
  ];

  it('fails open when enforcement is disabled', () => {
    const snapshot = buildStateTransitionGuardSnapshot({
      stateTransitionsFeatureEnabled: false,
      boardEnforced: true,
      rules: [
        {
          currentState: 'Todo',
          currentStateId: 'todo',
          allowedNextStates: ['Doing'],
          allowedNextStateIds: ['doing'],
          forbiddenNextStates: ['Done'],
          forbiddenNextStateIds: ['done'],
        },
      ],
      knownLists,
    });

    expect(canMoveWithSnapshot(snapshot, 'todo', 'done')).toBe(true);
  });

  it('allows configured transitions and rejects forbidden ones', () => {
    const snapshot = buildStateTransitionGuardSnapshot({
      stateTransitionsFeatureEnabled: true,
      boardEnforced: true,
      rules: [
        {
          currentState: 'Todo',
          currentStateId: 'todo',
          allowedNextStates: ['Doing'],
          allowedNextStateIds: ['doing'],
          forbiddenNextStates: ['Done'],
          forbiddenNextStateIds: ['done'],
        },
      ],
      knownLists,
    });

    expect(canMoveWithSnapshot(snapshot, 'todo', 'doing')).toBe(true);
    expect(canMoveWithSnapshot(snapshot, 'todo', 'done')).toBe(false);

    const rejection = getRejectionReasonWithSnapshot(snapshot, 'todo', 'done');
    expect(rejection.allowedNextStates).toEqual([{ id: 'doing', name: 'Doing' }]);
    expect(rejection.fromListName).toBe('Todo');
    expect(rejection.toListName).toBe('Done');
  });

  it('treats lists with no outgoing rule as fully locked', () => {
    const snapshot = buildStateTransitionGuardSnapshot({
      stateTransitionsFeatureEnabled: true,
      boardEnforced: true,
      rules: [
        {
          currentState: 'Todo',
          currentStateId: 'todo',
          allowedNextStates: ['Doing'],
          allowedNextStateIds: ['doing'],
          forbiddenNextStates: ['Done'],
          forbiddenNextStateIds: ['done'],
        },
      ],
      knownLists,
    });

    expect(isListLockedWithSnapshot(snapshot, 'done')).toBe(true);
    expect(canMoveWithSnapshot(snapshot, 'done', 'todo')).toBe(false);
  });
});
