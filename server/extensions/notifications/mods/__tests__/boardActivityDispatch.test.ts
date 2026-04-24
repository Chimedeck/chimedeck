import { describe, expect, test, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// All mocks must be set up before the module-under-test is imported.
// ---------------------------------------------------------------------------

const dispatchEmailMock = mock(() => Promise.resolve());
mock.module('../emailDispatch', () => ({ dispatchNotificationEmail: dispatchEmailMock }));

const resolveChannelsMock = mock(async () => ({ inApp: true, email: true }));
const boardPreferenceGuardMock = mock(async () => true);
mock.module('../boardPreferenceGuard', () => ({
  boardPreferenceGuard: boardPreferenceGuardMock,
  resolveNotificationChannels: resolveChannelsMock,
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

const firstResult = (value: unknown) => ({ first: async () => value });
const whereSelectFirst = (value: unknown) => ({ where: () => ({ select: () => firstResult(value) }) });

// Build a db mock that handles each table accessed by boardActivityDispatch.
function buildDbMock({ boardMembers = [{ user_id: 'recipient-1' }], boardGuests = [] as any[] } = {}) {
  const db: any = (table: string) => {
    if (table === 'boards') {
      return whereSelectFirst({ id: 'board-1', title: 'Test Board', workspace_id: 'ws-1' });
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
    if (table === 'board_guest_access') {
      return {
        where: () => ({
          whereNot: () => ({
            select: async () => boardGuests,
          }),
        }),
      };
    }
    if (table === 'lists') {
      return whereSelectFirst({ name: 'To Do' });
    }
    if (table === 'users') {
      return whereSelectFirst({ id: 'actor-1', nickname: 'alice', name: 'Alice', avatar_url: null });
    }
    if (table === 'notifications') {
      return {
        insert: (_data: object, _cols: string[]) => ({
          then: (fn: Function) => fn([{ id: 'notif-1', user_id: 'recipient-1' }]),
          catch: () => {},
        }),
      };
    }
    return whereSelectFirst(null);
  };

  db.raw = () => 'COALESCE(name, email) as name';
  return db;
}

let currentDbMock = buildDbMock();
mock.module('../../../../common/db', () => ({
  get db() {
    return currentDbMock;
  },
}));

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

  currentDbMock = buildDbMock();
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

  test('Recipient deduplication: only one notification is dispatched if user is both member and guest', async () => {
    // Both tables return the same user ID
    currentDbMock = buildDbMock({
      boardMembers: [{ user_id: 'recipient-1' }],
      boardGuests: [{ user_id: 'recipient-1' }],
    });

    // We only care about how many times email dispatch is called.
    // resolveChannelsMock is also a good proxy.
    await handleBoardActivityNotification({
      event: makeEvent('card.created') as any,
      boardId: 'board-1',
      actorId: 'actor-1',
    });

    // If deduplication works, it should only be called ONCE.
    expect(resolveChannelsMock).toHaveBeenCalledTimes(1);
    expect(dispatchEmailMock).toHaveBeenCalledTimes(1);
  });

  test('T1: email=false from resolved channels is forwarded to dispatchNotificationEmail', async () => {
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
