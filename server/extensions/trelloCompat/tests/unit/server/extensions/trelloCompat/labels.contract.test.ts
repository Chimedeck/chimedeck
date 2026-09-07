import { describe, expect, it } from 'bun:test';
import { serializeEmbeddedLabel, serializeLabel } from '../../../../../serializers/label';

describe('trelloCompat labels adapter contract', () => {
  it('serializes standalone labels with required Trello keys only', () => {
    const label = serializeLabel({
      id: 'label-1',
      board_id: 'board-1',
      name: 'Urgent',
      color: 'red',
    });

    expect(label).toEqual({
      id: 'label-1',
      idBoard: 'board-1',
      name: 'Urgent',
      color: 'red',
    });
    expect(Object.keys(label).sort()).toEqual(['color', 'id', 'idBoard', 'name']);
  });

  it('normalizes embedded labels to canonical standalone shape', () => {
    const label = serializeEmbeddedLabel({ id: 'label-2' }, 'board-fallback');
    expect(label).toEqual({
      id: 'label-2',
      idBoard: 'board-fallback',
      name: '',
      color: null,
    });
  });
});
