import { describe, expect, it } from 'bun:test';
import { getStateTransitionErrorBodyText } from '../StateTransitionErrorPopup';

describe('StateTransitionErrorPopup', () => {
  it('builds direct-move rejection copy when allowed steps exist', () => {
    const bodyText = getStateTransitionErrorBodyText({
      fromListId: 'list-1',
      fromListName: 'In Progress',
      toListId: 'list-3',
      toListName: 'Done',
      allowedNextStates: [
        { id: 'list-2', name: 'In Review' },
        { id: 'list-4', name: 'Blocked' },
      ],
    });

    expect(bodyText).toBe('Cards in "In Progress" cannot be moved to "Done" directly.');
  });

  it('builds locked-column copy when no allowed transitions exist', () => {
    const bodyText = getStateTransitionErrorBodyText({
      fromListId: 'list-1',
      fromListName: 'In Progress',
      toListId: 'list-2',
      toListName: 'Anything',
      allowedNextStates: [],
    });

    expect(bodyText).toBe(
      'Cards in "In Progress" cannot be moved anywhere — this column has no allowed transitions.'
    );
  });
});
