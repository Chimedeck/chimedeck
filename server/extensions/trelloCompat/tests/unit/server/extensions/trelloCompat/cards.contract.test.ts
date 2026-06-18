import { describe, expect, it } from 'bun:test';
import { assertTrelloShape } from '../../../../../helpers/assertTrelloShape';
import { createCardFixture } from '../../../../../helpers/fixtures';
import { serializeCard } from '../../../../../serializers/card';

describe('trelloCompat cards adapter contract', () => {
  it('serializes card payload with required Trello card keys and nested badge/cover keys', () => {
    const card = serializeCard(
      createCardFixture({
        short_id: 42,
        due_date: '2026-06-01T08:30:00.000Z',
        start_date: '2026-05-25T09:00:00.000Z',
        cover_attachment_id: 'attachment-1',
        cover_size: 'FULL',
        cover_color: 'blue',
        attachmentCount: 3,
        commentCount: 4,
        checkItemCount: 5,
        checkItemsChecked: 2,
      })
    );

    expect(() => {
      assertTrelloShape('card', card);
    }).not.toThrow();

    expect(card).toMatchObject({
      id: 'card-1',
      name: 'Card One',
      desc: 'Card description',
      closed: false,
      idBoard: 'board-1',
      idList: 'list-1',
      idChecklists: ['checklist-1'],
      idLabels: ['label-1'],
      idMembers: ['member-1'],
      nodeId: 'card-1',
      dueReminder: null,
      shortLink: '42',
      shortUrl: '/trello/1/c/42',
      url: '/trello/1/cards/card-1',
      cover: {
        idAttachment: 'attachment-1',
        color: 'blue',
        idUploadedBackground: null,
        size: 'full',
        brightness: 'dark',
        isTemplate: false,
      },
      badges: {
        attachmentsByType: {
          trello: {
            board: 0,
            card: 0,
          },
        },
        fogbugz: '',
        checkItemsEarliestDue: null,
      },
    });

    expect(typeof card.pos).toBe('number');
    expect(card.badges).toMatchObject({
      location: false,
      votes: 0,
      viewingMemberVoted: false,
      subscribed: false,
      dueComplete: false,
      due: '2026-06-01T08:30:00.000Z',
      start: '2026-05-25T09:00:00.000Z',
      description: true,
      attachments: 3,
      comments: 4,
      checkItems: 5,
      checkItemsChecked: 2,
    });
  });

  it('applies Trello-compatible defaults for optional card fields', () => {
    const card = serializeCard({
      id: 'card-2',
      list_id: 'list-2',
      title: 'Card Two',
      archived: true,
      short_id: null,
      labels: [],
      members: [],
      checklists: [],
    });

    expect(card).toMatchObject({
      id: 'card-2',
      idBoard: '',
      desc: '',
      closed: true,
      due: null,
      start: null,
      dueReminder: null,
      idChecklists: [],
      idLabels: [],
      idMembers: [],
      cover: {
        idAttachment: null,
        color: null,
        idUploadedBackground: null,
        size: 'normal',
        brightness: 'dark',
        isTemplate: false,
      },
      badges: {
        due: null,
        start: null,
        description: false,
        attachments: 0,
        comments: 0,
        checkItems: 0,
        checkItemsChecked: 0,
        checkItemsEarliestDue: null,
        fogbugz: '',
      },
      shortLink: 'card-2',
      shortUrl: '/trello/1/c/card-2',
      url: '/trello/1/cards/card-2',
    });
  });

  it('normalizes date and id values into Trello-safe scalar types', () => {
    const card = serializeCard({
      ...createCardFixture(),
      due_date: 'invalid-date',
      start_date: 'also-invalid',
      short_id: '17',
      labels: [{ id: '1001' }],
      members: [{ user_id: '2002' }],
      checklists: [{ id: '3003' }],
    });

    expect(card.due).toBeNull();
    expect(card.start).toBeNull();
    expect(card.idShort).toBe(17);
    expect(card.idChecklists.every((id) => typeof id === 'string')).toBe(true);
    expect(card.idLabels.every((id) => typeof id === 'string')).toBe(true);
    expect(card.idMembers.every((id) => typeof id === 'string')).toBe(true);
  });

  it('normalizes embedded labels to the standalone label serializer shape', () => {
    const card = serializeCard({
      ...createCardFixture(),
      board_id: 'board-embedded',
      labels: [
        { id: 'label-raw-1' },
        { id: 'label-raw-2', board_id: 'board-explicit', name: 'Explicit', color: 'green' },
      ],
    });

    expect(card.labels).toEqual([
      { id: 'label-raw-1', idBoard: 'board-embedded', name: '', color: null },
      { id: 'label-raw-2', idBoard: 'board-explicit', name: 'Explicit', color: 'green' },
    ]);
    expect(card.idLabels).toEqual(['label-raw-1', 'label-raw-2']);
  });
});
