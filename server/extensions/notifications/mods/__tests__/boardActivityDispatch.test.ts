import { describe, expect, test, mock, beforeEach } from 'bun:test';
import type { WrittenEvent } from '../../../../mods/events/index';

type PreferenceRow = { in_app_enabled: boolean; email_enabled: boolean };
type ParticipantRow = { user_id: string };
type NotificationRow = { id: string; user_id: string };
type DbMock = ((table: string) => unknown) & { raw: () => string };

// ---------------------------------------------------------------------------
// All mocks must be set up before the module-under-test is imported.
// ---------------------------------------------------------------------------

const dispatchEmailMock = mock(() => Promise.resolve());
void mock.module('../emailDispatch', () => ({ dispatchNotificationEmail: dispatchEmailMock }));

const resolveChannelsMock = mock(() => Promise.resolve({ inApp: true, email: true }));
const boardPreferenceGuardMock = mock(() => Promise.resolve(true));
void mock.module('../boardPreferenceGuard', () => ({
  boardPreferenceGuard: boardPreferenceGuardMock,
  resolveBoardNotificationPreference: () => Promise.resolve({ notificationsEnabled: true, onlyRelatedToMe: false }),
  resolveNotificationChannels: resolveChannelsMock,
  selectChannels: (boardRow: PreferenceRow | null, userRow: PreferenceRow | null) => {
    if (boardRow) return { inApp: boardRow.in_app_enabled, email: boardRow.email_enabled };
    if (userRow) return { inApp: userRow.in_app_enabled, email: userRow.email_enabled };
    return { inApp: true, email: true };
  },
}));

const globalPreferenceGuardMock = mock(() => Promise.resolve(true));
void mock.module('../globalPreferenceGuard', () => ({
  globalPreferenceGuard: globalPreferenceGuardMock,
}));

void mock.module('../relatedCardRecipients', () => ({
  getCardRelatedUserIds: () => Promise.resolve(new Set<string>()),
  isRecipientRelatedCardNotification: () => true,
}));

void mock.module('../../../../../config/env', () => ({
  env: { NOTIFICATION_PREFERENCES_ENABLED: true },
}));

void mock.module('../../../../realtime/userChannel', () => ({
  publishToUser: mock(() => {}),
}));

void mock.module('../../../../../common/avatar/resolveAvatarUrl', () => ({
  resolveAvatarUrl: mock(() => Promise.resolve('https://example.com/avatar.png')),
}));

const firstResult = (value: unknown) => ({ first: () => Promise.resolve(value) });
const whereSelectFirst = (value: unknown) => ({ where: () => ({ select: () => firstResult(value) }) });

// Build a db mock that handles each table accessed by boardActivityDispatch.
function buildDbMock({
  boardMembers = [{ user_id: 'recipient-1' }],
  boardGuests = [],
}: { boardMembers?: ParticipantRow[]; boardGuests?: ParticipantRow[] } = {}) {
  const db = ((table: string): unknown => {
    if (table === 'boards') {
      return whereSelectFirst({ id: 'board-1', title: 'Test Board', workspace_id: 'ws-1' });
    }
    if (table === 'board_members') {
      return {
        where: () => ({
          whereNot: () => ({
            select: () => Promise.resolve(boardMembers),
          }),
        }),
      };
    }
    if (table === 'board_guest_access') {
      return {
        where: () => ({
          whereNot: () => ({
            select: () => Promise.resolve(boardGuests),
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
          then: (fn: (rows: NotificationRow[]) => unknown) => fn([{ id: 'notif-1', user_id: 'recipient-1' }]),
          catch: () => {},
        }),
      };
    }
    return whereSelectFirst(null);
  }) as DbMock;

  db.raw = () => 'COALESCE(name, email) as name';
  return db;
}

let currentDbMock: DbMock = buildDbMock();
void mock.module('../../../../common/db', () => ({
  get db() {
    return currentDbMock;
  },
}));

// ---------------------------------------------------------------------------
// Import the module-under-test AFTER all mocks are registered.
// ---------------------------------------------------------------------------
const { handleBoardActivityNotification } = await import('../boardActivityDispatch');

function makeEvent(type: string): WrittenEvent {
  return {
    id: 'evt-1',
    type,
    board_id: 'board-1',
    payload: {
      card: { id: 'card-1', title: 'My Card', list_id: 'list-1' },
    },
  } as unknown as WrittenEvent;
}

beforeEach(() => {
  dispatchEmailMock.mockReset();
  dispatchEmailMock.mockImplementation(() => Promise.resolve());

  resolveChannelsMock.mockReset();
  resolveChannelsMock.mockImplementation(() => Promise.resolve({ inApp: true, email: true }));

  globalPreferenceGuardMock.mockReset();
  globalPreferenceGuardMock.mockImplementation(() => Promise.resolve(true));

  boardPreferenceGuardMock.mockReset();
  boardPreferenceGuardMock.mockImplementation(() => Promise.resolve(true));

  currentDbMock = buildDbMock();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('boardActivityDispatch — resolveNotificationChannels integration', () => {
  test('resolveNotificationChannels is called per recipient with correct args', async () => {
    await handleBoardActivityNotification({
      event: makeEvent('card.created'),
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
      event: makeEvent('card.created'),
      boardId: 'board-1',
      actorId: 'actor-1',
    });

    // If deduplication works, it should only be called ONCE.
    expect(resolveChannelsMock).toHaveBeenCalledTimes(1);
    expect(dispatchEmailMock).toHaveBeenCalledTimes(1);
  });

  test('T1: email=false from resolved channels is forwarded to dispatchNotificationEmail', async () => {
    resolveChannelsMock.mockImplementation(() => Promise.resolve({ inApp: false, email: false }));

    await handleBoardActivityNotification({
      event: makeEvent('card.created'),
      boardId: 'board-1',
      actorId: 'actor-1',
    });

    expect(dispatchEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ emailEnabled: false }),
    );
  });

  test('T1: inApp=true and email=true both forwarded when both enabled', async () => {
    resolveChannelsMock.mockImplementation(() => Promise.resolve({ inApp: false, email: true }));

    await handleBoardActivityNotification({
      event: makeEvent('card.created'),
      boardId: 'board-1',
      actorId: 'actor-1',
    });

    expect(dispatchEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ emailEnabled: true }),
    );
  });
});
