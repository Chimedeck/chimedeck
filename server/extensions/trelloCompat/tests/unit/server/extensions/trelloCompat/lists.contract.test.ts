import { describe, expect, it } from 'bun:test';
import { assertTrelloShape } from '../../../../../helpers/assertTrelloShape';
import { createListFixture } from '../../../../../helpers/fixtures';
import { serializeList } from '../../../../../serializers/list';

describe('trelloCompat lists adapter contract', () => {
  it('serializes list payload with required Trello keys', () => {
    const list = serializeList(createListFixture({ _rank: 2, color: 'green' }));

    expect(() => {
      assertTrelloShape('list', list);
    }).not.toThrow();

    expect(list).toMatchObject({
      id: 'list-1',
      name: 'List One',
      idBoard: 'board-1',
      closed: false,
      color: 'green',
      nodeId: 'list-1',
      softLimit: null,
      status: null,
      subscribed: false,
      limits: {},
    });
    expect(typeof list.pos).toBe('number');
  });

  it('applies Trello-compatible defaults for optional list fields', () => {
    const list = serializeList({
      id: 'list-2',
      board_id: 'board-2',
      title: 'List Two',
      archived: true,
    });

    expect(list).toMatchObject({
      id: 'list-2',
      idBoard: 'board-2',
      name: 'List Two',
      closed: true,
      color: null,
      nodeId: 'list-2',
      pos: 65535,
      softLimit: null,
      status: null,
      subscribed: false,
      limits: {},
    });
  });
});
