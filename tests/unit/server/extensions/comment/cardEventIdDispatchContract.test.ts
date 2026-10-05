// Dispatch-site payload contract tests (mocked): every producer dispatch site
// must thread a durable eventId into the signed payload, and the
// card.commented payload must carry additive interventionUserIds (covered by
// producer_intervention_contract.test.ts + the receiver suite).
// All IDs synthetic; endpoint 127.0.0.1:1; no network egress possible.
/* eslint-disable @typescript-eslint/no-explicit-any */
// [why] transplanted from sibling card t_c208ea26's dispatch-contract suite —
// the knex/timeline mocks are intentionally loose `any` proxies.
import { describe, expect, test, mock, beforeEach } from 'bun:test';

const writeActivityMock = mock(async (input: any) => ({
  id: 'activity-1',
  action: input.action,
  actor_id: input.actorId,
  payload: input.payload,
  created_at: new Date().toISOString(),
}));
const dispatchWebhookMock = mock(() => Promise.resolve());

// Generic chainable knex stand-in: every terminal verb resolves to a value.
function chain(final: any) {
  const p: any = Promise.resolve(final);
  const handler: any = {
    get(_t: unknown, prop: string) {
      if (prop === 'then') return p.then.bind(p);
      if (prop === 'catch') return p.catch.bind(p);
      if (prop === 'first') return () => p;
      return () => new Proxy(() => {}, handler);
    },
    apply() {
      return new Proxy(() => {}, handler);
    },
  };
  return new Proxy(() => {}, handler);
}
const dbMock = mock((table: string) => {
  if (table === 'users') return chain(undefined); // actor fetch misses → fallback payload
  return chain([]);
});
(dbMock as any).raw = () => 'RAW';
const trxMock = mock((table: string) => {
  if (table === 'notifications') return chain([{ id: 'notif-1' }]);
  return chain([]);
});

mock.module('../../../../../server/extensions/activity/mods/write', () => ({
  writeActivity: writeActivityMock,
}));
mock.module('../../../../../server/mods/events/publishCardActivityEvent', () => ({
  publishCardActivityEvent: mock(() => Promise.resolve()),
}));
mock.module('../../../../../server/extensions/activity/mods/mapActivityToNotification', () => ({
  mapActivityToNotification: mock(() => Promise.resolve()),
}));
mock.module('../../../../../server/common/db', () => ({ db: dbMock }));
mock.module('../../../../../server/config/env', () => ({
  env: { WEBHOOKS_ENABLED: true, NOTIFICATION_PREFERENCES_ENABLED: false },
}));
mock.module('../../../../../server/extensions/webhooks/mods/registry', () => ({
  getActiveWebhooksForEvent: mock(async () => [
    { id: 'wh-1', endpoint_url: 'http://127.0.0.1:1/hook', signing_secret: 's' },
  ]),
}));
mock.module('../../../../../server/extensions/webhooks/mods/dispatch', () => ({
  dispatchWebhook: dispatchWebhookMock,
}));

// Mention-site dependencies (notifications module).
mock.module('../../../../../server/extensions/realtime/userChannel', () => ({
  publishToUser: mock(() => Promise.resolve()),
}));
mock.module('../../../../../server/extensions/notifications/mods/preferenceGuard', () => ({
  preferenceGuard: mock(async () => ({ in_app_enabled: true })),
}));
mock.module('../../../../../server/extensions/notifications/mods/boardPreferenceGuard', () => ({
  boardPreferenceGuard: mock(async () => true),
}));
mock.module('../../../../../server/extensions/notifications/mods/globalPreferenceGuard', () => ({
  globalPreferenceGuard: mock(async () => true),
}));
mock.module('../../../../../server/extensions/notifications/mods/emailDispatch', () => ({
  dispatchNotificationEmail: mock(() => Promise.resolve()),
}));

const { emitCardMemberAssigned, emitCardMemberUnassigned } =
  await import('../../../../../server/extensions/activity/mods/createActivityEvent');
const { createNotificationsForMentions } =
  await import('../../../../../server/extensions/notifications/mods/createNotifications');

// fire-and-forget webhook helpers need a microtask/timer flush before asserts.
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  writeActivityMock.mockClear();
  dispatchWebhookMock.mockClear();
});

describe('member webhook dispatch carries durable eventId', () => {
  test('emitCardMemberAssigned threads the persisted activity.id as eventId', async () => {
    await emitCardMemberAssigned({
      actorId: 'actor-1',
      cardId: 'card-1',
      cardTitle: 'Card title',
      userId: 'user-2',
      assigneeName: 'Bob',
      boardId: 'board-1',
      workspaceId: 'workspace-1',
    });
    await flush();

    expect(dispatchWebhookMock).toHaveBeenCalledTimes(1);
    const call = dispatchWebhookMock.mock.calls[0][0];
    // eventId must be the persisted activities.id UUID (from writeActivity).
    expect(call.payload.eventId).toBe('activity-1');
    expect(call.eventType).toBe('card.member_assigned');
  });

  test('emitCardMemberUnassigned threads the persisted activity.id as eventId', async () => {
    await emitCardMemberUnassigned({
      actorId: 'actor-1',
      cardId: 'card-1',
      cardTitle: 'Card title',
      userId: 'user-2',
      assigneeName: 'Bob',
      boardId: 'board-1',
      workspaceId: 'workspace-1',
    });
    await flush();

    expect(dispatchWebhookMock).toHaveBeenCalledTimes(1);
    const call = dispatchWebhookMock.mock.calls[0][0];
    expect(call.payload.eventId).toBe('activity-1');
    expect(call.eventType).toBe('card.member_removed');
  });
});

describe('mention webhook dispatch carries durable eventId', () => {
  test('one mention emission sends ONE webhook with a conforming eventId', async () => {
    await createNotificationsForMentions({
      trx: trxMock as any,
      addedUserIds: ['user-a', 'user-b'],
      actorId: 'actor-1',
      sourceType: 'comment',
      sourceId: 'comment-1',
      cardId: 'card-1',
      boardId: 'board-1',
    });
    await flush();

    expect(dispatchWebhookMock).toHaveBeenCalledTimes(1);
    const call = dispatchWebhookMock.mock.calls[0][0];
    expect(call.eventType).toBe('mention');
    // Conforming eventId: non-empty string, ≤128 chars, NOT the sourceId.
    const eventId = call.payload.eventId;
    expect(typeof eventId).toBe('string');
    expect(eventId.length).toBeGreaterThan(0);
    expect(eventId.length).toBeLessThanOrEqual(128);
    expect(eventId).not.toBe('comment-1');
    expect(eventId).not.toBe('card-1');
    // Mention context is preserved alongside the new field.
    expect(call.payload.mentionedUserIds).toEqual(['user-a', 'user-b']);
  });

  test('distinct logical mention emissions mint distinct eventIds', async () => {
    for (let i = 0; i < 2; i++) {
      await createNotificationsForMentions({
        trx: trxMock as any,
        addedUserIds: ['user-a'],
        actorId: 'actor-1',
        sourceType: 'card_description',
        sourceId: 'card-1',
        cardId: 'card-1',
        boardId: 'board-1',
      });
      await flush();
    }
    expect(dispatchWebhookMock).toHaveBeenCalledTimes(2);
    const first = dispatchWebhookMock.mock.calls[0][0].payload.eventId;
    const second = dispatchWebhookMock.mock.calls[1][0].payload.eventId;
    expect(first).not.toBe(second);
  });
});
