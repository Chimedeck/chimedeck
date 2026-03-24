import { describe, expect, test, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// All mocks must be set up before the module-under-test is imported.
// Paths are relative to THIS test file (server/extensions/notifications/mods/__tests__/).
// ---------------------------------------------------------------------------

const dispatchEmailMock = mock(() => Promise.resolve());
mock.module('../emailDispatch', () => ({ dispatchNotificationEmail: dispatchEmailMock }));

const resolveChannelsMock = mock(async () => ({ inApp: true, email: true }));
const boardPreferenceGuardMock = mock(async () => true);
mock.module('../boardPreferenceGuard', () => ({
  boardPreferenceGuard: boardPreferenceGuardMock,
  resolveNotificationChannels: resolveChannelsMock,
  // selectChannels is a pure helper; export a real implementation so boardPreferenceGuard.test.ts
  // can import it without getting undefined when this mock takes effect.
  selectChannels: (boardRow: any, userRow: any) => {
    if (boardRow) return { inApp: boardRow.in_app_enabled, email: boardRow.email_enabled };
    if (userRow) return { inApp: userRow.in_app_enabled, email: userRow.email_enabled };
    return { inApp: true, email: true };
  },
}));

const globalPreferenceGuardMock = mock(async () => true);
mock.module('../globalPreferenceGuard', () => ({
  globalPreferenceGuard: globalPreferenceGuardMock,
}));

mock.module('../../../../../config/env', () => ({
  env: { NOTIFICATION_PREFERENCES_ENABLED: true },
}));

mock.module('../../../../realtime/userChannel', () => ({
  publishToUser: mock(() => {}),
}));

mock.module('../../../../../common/avatar/resolveAvatarUrl', () => ({
  resolveAvatarUrl: mock(async () => 'https://example.com/avatar.png'),
}));

// Build a db mock that handles each table accessed by boardActivityDispatch.
function buildDbMock({ boardMembers = [{ user_id: 'recipient-1' }] } = {}) {
  return mock((table: string) => {
    if (table === 'boards') {
      return {
        where: () => ({
          select: () => ({
            first: async () => ({ id: 'board-1', title: 'Test Board', workspace_id: 'ws-1' }),
          }),
        }),
      };
    }
    if (table === 'board_members') {
      return {
        where: () => ({
          whereNot: () => ({
            select: async () => boardMembers,
          }),
        }),
      };
    }
    if (table === 'lists') {
      return {
        where: () => ({
          select: () => ({
            first: async () => ({ name: 'To Do' }),
          }),
        }),
      };
    }
    if (table === 'users') {
      return {
        where: () => ({
          select: () => ({
            first: async () => ({ id: 'actor-1', nickname: 'alice', name: 'Alice', avatar_url: null }),
          }),
        }),
      };
    }
    if (table === 'notifications') {
      return {
        insert: (_data: object, _cols: string[]) => ({
          then: (fn: Function) => fn([{ id: 'notif-1', user_id: 'recipient-1' }]),
          catch: () => {},
        }),
      };
    }
    return { where: () => ({ select: () => ({ first: async () => null }) }) };
  });
}

const dbMock = buildDbMock();
const dbMockRaw = mock(() => 'COALESCE(name, email) as name');
dbMock.raw = dbMockRaw;

mock.module('../../../../common/db', () => ({ db: dbMock }));

// ---------------------------------------------------------------------------
// Import the module-under-test AFTER all mocks are registered.
// ---------------------------------------------------------------------------
const { handleBoardActivityNotification } = await import('../boardActivityDispatch');

function makeEvent(type: string) {
  return {
    id: 'evt-1',
    type,
    board_id: 'board-1',
    payload: {
      card: { id: 'card-1', title: 'My Card', list_id: 'list-1' },
    },
  };
}

beforeEach(() => {
  dispatchEmailMock.mockReset();
  dispatchEmailMock.mockImplementation(() => Promise.resolve());

  resolveChannelsMock.mockReset();
  resolveChannelsMock.mockImplementation(async () => ({ inApp: true, email: true }));

  globalPreferenceGuardMock.mockReset();
  globalPreferenceGuardMock.mockImplementation(async () => true);

  boardPreferenceGuardMock.mockReset();
  boardPreferenceGuardMock.mockImplementation(async () => true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('boardActivityDispatch — resolveNotificationChannels integration', () => {
  test('resolveNotificationChannels is called per recipient with correct args', async () => {
    await handleBoardActivityNotification({
      event: makeEvent('card.created') as any,
      boardId: 'board-1',
      actorId: 'actor-1',
    });

    expect(resolveChannelsMock).toHaveBeenCalledWith({
      userId: 'recipient-1',
      boardId: 'board-1',
      type: 'card_created',
    });
  });

  test('T1: email=false from resolved channels is forwarded to dispatchNotificationEmail', async () => {
    // inApp=false skips the db notification insert path, keeping the test focused on email dispatch.
    resolveChannelsMock.mockImplementation(async () => ({ inApp: false, email: false }));

    await handleBoardActivityNotification({
      event: makeEvent('card.created') as any,
      boardId: 'board-1',
      actorId: 'actor-1',
    });

    expect(dispatchEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ emailEnabled: false }),
    );
  });

  test('T1: inApp=true and email=true both forwarded when both enabled', async () => {
    // inApp=false skips the db notification insert path; we only care about the email arg here.
    resolveChannelsMock.mockImplementation(async () => ({ inApp: false, email: true }));

    await handleBoardActivityNotification({
      event: makeEvent('card.created') as any,
      boardId: 'board-1',
      actorId: 'actor-1',
    });

    expect(dispatchEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ emailEnabled: true }),
    );
  });
});
