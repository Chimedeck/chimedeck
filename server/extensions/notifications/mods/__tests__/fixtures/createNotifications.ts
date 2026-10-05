import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

// [why] subprocess-isolated fixture — mock.module leaks globally across a Bun test
// run, so this real-handler exercise runs in a dedicated process (see
// createNotifications.test.ts) to avoid poisoning unrelated test files' db mocks.

type Row = Record<string, unknown> | undefined;

const rows = new Map<string, Row>();
const calls: unknown[] = [];
let failingTable = '';
let notificationPreferencesEnabled = false;
let webhooksEnabled = false;
const guardFailure = new Error('guard read failed');
let insertedRow: Record<string, unknown> | null = null;

void mock.module('../../../../../common/db', () => {
  const db = (table: string) => {
    calls.push({ table });
    return {
      where(filter: Record<string, unknown>) {
        calls.push({ table, where: filter });
        return this;
      },
      select(...columns: unknown[]) {
        calls.push({ table, select: columns });
        return this;
      },
      first() {
        if (table === failingTable) return Promise.reject(guardFailure);
        return Promise.resolve(rows.get(table));
      },
    };
  };
  db.raw = (sql: string) => sql;
  return { db };
});

void mock.module('../../../../../config/env', () => ({
  env: {
    get NOTIFICATION_PREFERENCES_ENABLED() { return notificationPreferencesEnabled; },
    get WEBHOOKS_ENABLED() { return webhooksEnabled; },
  },
}));

const publishCalls: unknown[] = [];
void mock.module('../../../../realtime/userChannel', () => ({
  publishToUser: (userId: string, message: unknown) => {
    publishCalls.push({ userId, message });
    return Promise.resolve();
  },
}));

void mock.module('../../../../../common/avatar/resolveAvatarUrl', () => ({
  buildAvatarProxyUrl: ({ userId, avatarUrl }: { userId: string; avatarUrl: string | null }) =>
    avatarUrl ? `/api/v1/users/${userId}/avatar` : null,
}));

const emailCalls: unknown[] = [];
void mock.module('../../emailDispatch', () => ({
  dispatchNotificationEmail: (args: unknown) => {
    emailCalls.push(args);
    return Promise.resolve();
  },
}));

const webhookCalls: unknown[] = [];
void mock.module('../../../../webhooks/mods/registry', () => ({
  getActiveWebhooksForEvent: () =>
    Promise.resolve([
      { id: 'wh-1', endpoint_url: 'https://example.com/hook', signing_secret: 'secret' },
    ]),
}));
void mock.module('../../../../webhooks/mods/dispatch', () => ({
  dispatchWebhook: (args: unknown) => {
    webhookCalls.push(args);
    return Promise.resolve();
  },
}));

const { createNotificationsForMentions } = await import('../../createNotifications');

function reset() {
  rows.clear();
  calls.length = 0;
  publishCalls.length = 0;
  emailCalls.length = 0;
  webhookCalls.length = 0;
  insertedRow = null;
  failingTable = '';
  notificationPreferencesEnabled = false;
  webhooksEnabled = false;
}

// [why] production code calls `trx('notifications')` directly (not the mocked `db`
// module) for the insert, so trx must be a callable stand-in with the same shape.
const trx = ((table: string) => {
  calls.push({ table });
  return {
    insert(data: Record<string, unknown>) {
      insertedRow = data;
      return this;
    },
    returning() {
      calls.push({ table, insert: insertedRow });
      return Promise.resolve([{ id: 'notif-1', ...insertedRow }]);
    },
  };
}) as never;

// --- 1. Self-mention is filtered: actor never receives a notification about their own mention.
reset();
await createNotificationsForMentions({
  trx,
  addedUserIds: ['actor-1'],
  actorId: 'actor-1',
  sourceType: 'comment',
  sourceId: 'comment-1',
  cardId: 'card-1',
  boardId: 'board-1',
});
assert.equal(publishCalls.length, 0, 'actor must not be notified of their own mention');
assert.equal(insertedRow, null, 'no notification row should be inserted for a self-mention');

// --- 2. Globally disabled recipient (fail-closed on explicit false, not fail-open).
reset();
rows.set('user_notification_settings', { global_notifications_enabled: false });
await createNotificationsForMentions({
  trx,
  addedUserIds: ['user-a'],
  actorId: 'actor-1',
  sourceType: 'comment',
  sourceId: 'comment-1',
  cardId: 'card-1',
  boardId: 'board-1',
});
assert.equal(publishCalls.length, 0, 'globally-disabled recipient must not be notified');
assert.equal(insertedRow, null);

// --- 3. Board-level opt-out disables the recipient.
reset();
rows.set('board_notification_preferences', { notifications_enabled: false, only_related_to_me: false });
await createNotificationsForMentions({
  trx,
  addedUserIds: ['user-a'],
  actorId: 'actor-1',
  sourceType: 'comment',
  sourceId: 'comment-1',
  cardId: 'card-1',
  boardId: 'board-1',
});
assert.equal(publishCalls.length, 0, 'board-disabled recipient must not be notified');
assert.equal(insertedRow, null);

// --- 4. Guard lookup failure fails OPEN — notification still proceeds (documented behaviour).
reset();
failingTable = 'user_notification_settings';
rows.set('board_members', { user_id: 'user-a', board_id: 'board-1' });
await createNotificationsForMentions({
  trx,
  addedUserIds: ['user-a'],
  actorId: 'actor-1',
  sourceType: 'comment',
  sourceId: 'comment-1',
  cardId: 'card-1',
  boardId: 'board-1',
});
assert.equal(publishCalls.length, 1, 'guard read failure must fail open and still notify');
assert.notEqual(insertedRow, null);

// --- 5. Per-type in-app preference disabled skips both insert and email dispatch.
reset();
notificationPreferencesEnabled = true;
rows.set('notification_preferences', { in_app_enabled: false, email_enabled: true });
rows.set('board_members', { user_id: 'user-a', board_id: 'board-1' });
await createNotificationsForMentions({
  trx,
  addedUserIds: ['user-a'],
  actorId: 'actor-1',
  sourceType: 'comment',
  sourceId: 'comment-1',
  cardId: 'card-1',
  boardId: 'board-1',
});
assert.equal(publishCalls.length, 0, 'in_app_enabled=false must skip WS publish');
assert.equal(insertedRow, null, 'in_app_enabled=false must skip notification row insert');
assert.equal(emailCalls.length, 0, 'in_app_enabled=false must also skip the mention email');

// --- 6. Successful path: typed insert row + actor payload shape survives the boundary.
reset();
rows.set('users', { id: 'actor-1', nickname: 'alice', name: 'Alice', avatar_url: 'avatars/a.png' });
rows.set('board_members', { user_id: 'user-a', board_id: 'board-1' });
await createNotificationsForMentions({
  trx,
  addedUserIds: ['user-a'],
  actorId: 'actor-1',
  sourceType: 'comment',
  sourceId: 'comment-1',
  sourceText: 'hello @user-a',
  cardId: 'card-1',
  boardId: 'board-1',
  cardTitle: 'My Card',
  boardName: 'My Board',
});
assert.equal(publishCalls.length, 1);
assert.equal(emailCalls.length, 1);
const published = publishCalls[0] as { userId: string; message: { payload: { notification: Record<string, unknown> } } };
assert.equal(published.userId, 'user-a');
const notification = published.message.payload.notification;
assert.equal(notification['id'], 'notif-1');
assert.equal(notification['user_id'], 'user-a');
assert.equal(notification['card_title'], 'My Card');
assert.equal(notification['board_title'], 'My Board');
assert.equal(notification['comment_content'], 'hello @user-a');
assert.deepEqual(notification['actor'], {
  id: 'actor-1',
  nickname: 'alice',
  name: 'Alice',
  avatar_url: '/api/v1/users/actor-1/avatar',
});
assert.ok(insertedRow, 'expected notifyMentionedUser to insert a notification row');
const insertedNotification: Record<string, unknown> = insertedRow;
assert.equal(insertedNotification['type'], 'mention');
assert.equal(insertedNotification['source_type'], 'comment');
assert.equal(insertedNotification['card_id'], 'card-1');

// --- 7. Actor row missing falls back to a null actor payload (no throw on unknown actor).
reset();
rows.set('users', undefined);
rows.set('board_members', { user_id: 'user-a', board_id: 'board-1' });
await createNotificationsForMentions({
  trx,
  addedUserIds: ['user-a'],
  actorId: 'ghost-actor',
  sourceType: 'card_description',
  sourceId: 'card-1',
  cardId: 'card-1',
  boardId: 'board-1',
});
assert.equal(publishCalls.length, 1);
const fallbackNotification = (publishCalls[0] as { message: { payload: { notification: Record<string, unknown> } } }).message.payload.notification;
assert.deepEqual(fallbackNotification['actor'], { id: 'ghost-actor', nickname: null, name: null, avatar_url: null });

// --- 8. Mention webhook is fired exactly once per mention event, not once per recipient.
reset();
webhooksEnabled = true;
rows.set('board_members', { user_id: 'user-a', board_id: 'board-1' });
await createNotificationsForMentions({
  trx,
  addedUserIds: ['user-a', 'user-b'],
  actorId: 'actor-1',
  sourceType: 'comment',
  sourceId: 'comment-1',
  cardId: 'card-1',
  boardId: 'board-1',
});
// give the fire-and-forget webhook dispatch microtask a tick to run
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(webhookCalls.length, 1, 'webhook must be dispatched once per mention event, not per recipient');
const webhookPayload = (webhookCalls[0] as { payload: { mentionedUserIds: string[] } }).payload;
assert.deepEqual(webhookPayload.mentionedUserIds, ['user-a', 'user-b']);

console.info('real createNotifications handler: guards, preferences, insert payload shape and webhook fan-out verified');
