import { describe, expect, it } from 'bun:test';
import { assertTrelloShape } from '../../../../../helpers/assertTrelloShape';
import { createBoardFixture } from '../../../../../helpers/fixtures';
import { serializeBoard, serializeBoardLabels } from '../../../../../serializers/board';

describe('trelloCompat boards adapter contract', () => {
  it('serializes board payload with required Trello board keys', () => {
    const board = serializeBoard(createBoardFixture());

    expect(() => {
      assertTrelloShape('board', board);
    }).not.toThrow();

    expect(board).toMatchObject({
      id: 'board-1',
      name: 'Board One',
      desc: 'Board description',
      idOrganization: 'workspace-1',
      idTags: [],
      powerUps: [],
      limits: {},
      nodeId: 'board-1',
      shortLink: 'board-1',
      shortUrl: '/trello/1/b/board-1',
      url: '/trello/1/boards/board-1',
      prefs: {
        permissionLevel: 'org',
        calendarFeedEnabled: false,
        background: 'blue',
        backgroundImage: null,
        backgroundTile: false,
        backgroundBrightness: 'unknown',
        canBePublic: true,
        canBeEnterprise: false,
        canBeOrg: true,
        canBePrivate: true,
      },
    });
  });

  it('maps board visibility to Trello permissionLevel', () => {
    expect(serializeBoard(createBoardFixture({ visibility: 'PUBLIC' })).prefs.permissionLevel).toBe(
      'public'
    );
    expect(
      serializeBoard(createBoardFixture({ visibility: 'WORKSPACE' })).prefs.permissionLevel
    ).toBe('org');
    expect(
      serializeBoard(createBoardFixture({ visibility: 'PRIVATE' })).prefs.permissionLevel
    ).toBe('private');
  });

  it('uses Trello-compatible defaults for optional fields', () => {
    const board = serializeBoard({
      id: 'board-2',
      title: 'Board Two',
      state: 'ACTIVE',
      workspace_id: 'workspace-2',
    });

    expect(board.dateLastActivity).toBeNull();
    expect(board.idMemberCreator).toBe('');
    expect(board.memberships).toEqual([]);
    expect(board.prefs.background).toBe('blue');
  });

  it('uses short_id when present for shortLink and shortUrl', () => {
    const board = serializeBoard({
      ...createBoardFixture(),
      short_id: 'abc123',
    });

    expect(board.shortLink).toBe('abc123');
    expect(board.shortUrl).toBe('/trello/1/b/abc123');
  });

  it('normalizes board-scoped embedded labels to canonical shape', () => {
    const labels = serializeBoardLabels(
      [
        { id: 'label-1' },
        { id: 'label-2', board_id: 'board-override', name: 'Urgent', color: 'red' },
      ],
      'board-1'
    );

    expect(labels).toEqual([
      { id: 'label-1', idBoard: 'board-1', name: '', color: null },
      { id: 'label-2', idBoard: 'board-override', name: 'Urgent', color: 'red' },
    ]);
  });
});
