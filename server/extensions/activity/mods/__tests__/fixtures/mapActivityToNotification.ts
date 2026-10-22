import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// Real handler under test: mapActivityToNotification. Shared DB and
// notification-guard modules are mocked here in a subprocess so this
// fixture cannot leak state into (or be replaced by) adjacent tests.
const calls: unknown[] = [];

const state: {
  board: Record<string, unknown> | undefined;
  boardMembers: Array<{ user_id: string }>;
  boardGuests: Array<{ user_id: string }>;
  actor: Record<string, unknown> | undefined;
  globalEnabled: boolean;
  boardPreference: { notificationsEnabled: boolean; onlyRelatedToMe: boolean };
  inAppEnabled: boolean;
  insertedRow: Record<string, unknown> | undefined;
} = {
  board: { id: 'board-1', title: 'Board One', workspace_id: 'ws-1' },
  boardMembers: [{ user_id: 'member-1' }, { user_id: 'actor-1' }],
  boardGuests: [{ user_id: 'guest-1' }],
  actor: { id: 'actor-1', nickname: null, name: 'Actor Name', avatar_url: null },
  globalEnabled: true,
  boardPreference: { notificationsEnabled: true, onlyRelatedToMe: false },
  inAppEnabled: true,
  insertedRow: {
    id: 'notif-1',
    user_id: 'member-1',
    type: 'card_created',
    source_type: 'board_activity',
    source_id: 'activity-1',
    card_id: 'card-1',
    board_id: 'board-1',
    actor_id: 'actor-1',
    read: false,
    created_at: '2026-01-01T00:00:00.000Z',
  },
};

void mock.module('../../../../../common/db', () => ({
  db: Object.assign(
    (table: string) => {
      calls.push(['db', table]);
      if (table === 'boards') {
        return {
          where: (filter: Record<string, unknown>) => {
            calls.push(['boards.where', filter]);
            return {
              select: (...cols: unknown[]) => {
                calls.push(['boards.select', cols]);
                return { first: () => Promise.resolve(state.board) };
              },
            };
          },
        };
      }
      if (table === 'board_members') {
        return {
          where: (filter: Record<string, unknown>) => {
            calls.push(['board_members.where', filter]);
            return { select: (..._cols: unknown[]) => Promise.resolve(state.boardMembers) };
          },
        };
      }
      if (table === 'board_guest_access') {
        return {
          where: (filter: Record<string, unknown>) => {
            calls.push(['board_guest_access.where', filter]);
            return { select: (..._cols: unknown[]) => Promise.resolve(state.boardGuests) };
          },
        };
      }
      if (table === 'users') {
        return {
          where: (filter: Record<string, unknown>) => {
            calls.push(['users.where', filter]);
            return {
              select: (...cols: unknown[]) => {
                calls.push(['users.select', cols]);
                return { first: () => Promise.resolve(state.actor) };
              },
            };
          },
        };
      }
      if (table === 'notifications') {
        return {
          insert: (payload: Record<string, unknown>, returning: unknown) => {
            calls.push(['notifications.insert', payload, returning]);
            return Promise.resolve(state.insertedRow ? [state.insertedRow] : []);
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    { raw: (sql: string) => sql },
  ),
}));

void mock.module('../../../../notifications/mods/preferenceGuard', () => ({
  preferenceGuard: (input: { userId: string; type: string }) => {
    calls.push(['preferenceGuard', input]);
    return Promise.resolve({ in_app_enabled: state.inAppEnabled });
  },
}));

void mock.module('../../../../notifications/mods/boardPreferenceGuard', () => ({
  resolveBoardNotificationPreference: (input: { userId: string; boardId: string }) => {
    calls.push(['resolveBoardNotificationPreference', input]);
    return Promise.resolve(state.boardPreference);
  },
}));

void mock.module('../../../../notifications/mods/globalPreferenceGuard', () => ({
  globalPreferenceGuard: (input: { userId: string }) => {
    calls.push(['globalPreferenceGuard', input]);
    return Promise.resolve(state.globalEnabled);
  },
}));

const publishedMessages: Array<{ userId: string; message: unknown }> = [];
void mock.module('../../../../realtime/userChannel', () => ({
  publishToUser: (userId: string, message: unknown) => {
    publishedMessages.push({ userId, message });
    return Promise.resolve();
  },
}));

void mock.module('../../../../../common/avatar/resolveAvatarUrl', () => ({
  buildAvatarProxyUrl: (input: { userId: string; avatarUrl: string }) => `proxy:${input.avatarUrl}`,
}));

const dispatchedEmails: unknown[] = [];
void mock.module('../../../../notifications/mods/emailDispatch', () => ({
  dispatchNotificationEmail: (input: unknown) => {
    dispatchedEmails.push(input);
    return Promise.resolve();
  },
}));

void mock.module('../../../../../config/env', () => ({
  env: { NOTIFICATION_PREFERENCES_ENABLED: true },
}));

void mock.module('../../../../notifications/mods/relatedCardRecipients', () => ({
  getCardRelatedUserIds: (input: { cardId: string | null }) => {
    calls.push(['getCardRelatedUserIds', input]);
    return Promise.resolve([]);
  },
  isRecipientRelatedCardNotification: () => true,
}));

const { mapActivityToNotification } = await import('../../mapActivityToNotification');

function activity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'activity-1',
    action: 'card_created',
    actor_id: 'actor-1',
    payload: { cardId: 'card-1', cardTitle: 'Card One', listName: 'To Do' },
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// 1. Unsupported action is a no-op — no DB reads at all.
calls.length = 0;
await mapActivityToNotification({
  activity: activity({ action: 'unsupported_action' }) as never,
  boardId: 'board-1',
});
assert.equal(calls.length, 0);

// 2. Board not found short-circuits before recipient resolution.
state.board = undefined;
calls.length = 0;
await mapActivityToNotification({ activity: activity() as never, boardId: 'board-1' });
assert.deepEqual(
  calls.filter((c) => Array.isArray(c) && c[0] === 'db'),
  [['db', 'boards']],
);
state.board = { id: 'board-1', title: 'Board One', workspace_id: 'ws-1' };

// 3. Happy path: actor excluded from recipients, board member + guest notified,
// notification row inserted with typed columns preserved, and the WS payload
// carries the actor/board fields resolved from the typed reads.
calls.length = 0;
publishedMessages.length = 0;
dispatchedEmails.length = 0;
await mapActivityToNotification({ activity: activity() as never, boardId: 'board-1' });

const insertCall = calls.find(
  (c) => Array.isArray(c) && c[0] === 'notifications.insert',
) as [string, Record<string, unknown>, unknown];
assert.ok(insertCall, 'expected a notifications.insert call');
assert.equal(insertCall[1].actor_id, 'actor-1');
assert.equal(insertCall[1].board_id, 'board-1');
assert.equal(insertCall[1].type, 'card_created');
assert.deepEqual(insertCall[2], ['*']);

const recipientIds = publishedMessages.map((m) => m.userId).sort();
assert.deepEqual(recipientIds, ['guest-1', 'member-1']);

const publishedPayload = publishedMessages[0]?.message as {
  payload: { notification: Record<string, unknown> };
};
assert.equal(publishedPayload.payload.notification.board_title, 'Board One');
assert.equal(publishedPayload.payload.notification.card_title, 'Card One');
const actorField = (publishedPayload.payload.notification as { actor: { name: string } }).actor;
assert.equal(actorField.name, 'Actor Name');

assert.equal(dispatchedEmails.length, 2);

// 4. Global opt-out guard blocks the recipient before the DB insert runs.
state.globalEnabled = false;
calls.length = 0;
publishedMessages.length = 0;
dispatchedEmails.length = 0;
await mapActivityToNotification({ activity: activity() as never, boardId: 'board-1' });
assert.equal(publishedMessages.length, 0);
assert.equal(
  calls.some((c) => Array.isArray(c) && c[0] === 'notifications.insert'),
  false,
);
state.globalEnabled = true;

console.info(
  'mapActivityToNotification real board/user/notification reads, recipient exclusion, insert payload and opt-out guard verified',
);
