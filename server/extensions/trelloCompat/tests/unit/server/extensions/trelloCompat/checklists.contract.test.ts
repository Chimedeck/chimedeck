import { describe, expect, it } from 'bun:test';
import { assertTrelloShape } from '../../../../../helpers/assertTrelloShape';
import { createCheckItemFixture, createChecklistFixture } from '../../../../../helpers/fixtures';
import { serializeCheckItem, serializeChecklist } from '../../../../../serializers/checklist';

describe('trelloCompat checklists adapter contract', () => {
  it('serializes checkItems with Trello-compatible state, dueReminder, idMember and numeric pos', () => {
    const completeItem = serializeCheckItem(
      createCheckItemFixture({
        id: 'item-1',
        checked: true,
        _rank: 1,
        due_date: '2026-06-01T00:00:00.000Z',
        assigned_member_id: 'member-1',
      })
    );
    const incompleteItem = serializeCheckItem(
      createCheckItemFixture({
        id: 'item-2',
        checked: false,
        _rank: 2,
        due_date: 'invalid-date',
        assigned_user_id: 'member-2',
        assigned_member_id: null,
      })
    );

    expect(() => {
      assertTrelloShape('checkitem', completeItem);
    }).not.toThrow();
    expect(() => {
      assertTrelloShape('checkitem', incompleteItem);
    }).not.toThrow();

    expect(completeItem).toMatchObject({
      id: 'item-1',
      state: 'complete',
      due: '2026-06-01T00:00:00.000Z',
      dueReminder: null,
      idMember: 'member-1',
    });
    expect(incompleteItem).toMatchObject({
      id: 'item-2',
      state: 'incomplete',
      due: null,
      dueReminder: null,
      idMember: 'member-2',
    });
    expect(typeof completeItem.pos).toBe('number');
    expect(typeof incompleteItem.pos).toBe('number');
  });

  it('serializes checklist payload with required Trello keys and numeric pos', () => {
    const checkItem = serializeCheckItem(createCheckItemFixture({ id: 'item-3', _rank: 3 }));
    const checklist = serializeChecklist(
      createChecklistFixture({
        id: 'checklist-2',
        _rank: 4,
        checkItems: [checkItem],
      })
    );

    expect(() => {
      assertTrelloShape('checklist', checklist);
    }).not.toThrow();
    expect(checklist).toMatchObject({
      id: 'checklist-2',
      idBoard: 'board-1',
      idCard: 'card-1',
      name: 'Checklist One',
      checkItems: [checkItem],
    });
    expect(typeof checklist.pos).toBe('number');
    expect(
      checklist.checkItems.every((item) => item.state === 'complete' || item.state === 'incomplete')
    ).toBe(true);
  });
});
