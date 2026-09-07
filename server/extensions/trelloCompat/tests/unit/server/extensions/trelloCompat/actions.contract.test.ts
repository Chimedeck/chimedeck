import { describe, expect, it } from 'bun:test';
import { assertTrelloShape } from '../../../../../helpers/assertTrelloShape';
import { createActivityActionFixture, createCommentActionFixture } from '../../../../../helpers/fixtures';
import { serializeActivityAction, serializeCommentAction } from '../../../../../serializers/action';

describe('trelloCompat actions adapter contract', () => {
  it('serializes comment and activity actions with required Trello keys', () => {
    const comment = serializeCommentAction(createCommentActionFixture());
    const activity = serializeActivityAction(createActivityActionFixture());

    expect(() => {
      assertTrelloShape('action-comment', comment);
    }).not.toThrow();
    expect(() => {
      assertTrelloShape('action-activity', activity);
    }).not.toThrow();
  });

  it('normalizes embedded label payloads in activity actions', () => {
    const activity = serializeActivityAction(createActivityActionFixture({
      board_id: 'board-embedded',
      payload: {
        label: { id: 'label-1', board_id: 'board-embedded', name: 'Urgent', color: 'red' },
        labels: [{ id: 'label-2' }],
      },
    }));

    expect(activity.data).toMatchObject({
      label: { id: 'label-1', idBoard: 'board-embedded', name: 'Urgent', color: 'red' },
      labels: [{ id: 'label-2', idBoard: 'board-embedded', name: '', color: null }],
    });
  });
});
