// Endpoint/dispatch contract test — comment intervention webhook payload.
// [why] The QA investigation proved the deployed card.commented payload can never
// queue a WhatsApp delivery (no per-user target). This test pins the contract:
// handleCreateComment must build its webhook payload via the intervention payload
// builder, carrying deduplicated interventionUserIds (assignees + reply target
// − actor − mentioned) plus boardTitle/actorName/sourcePreview, and dispatchEvent
// must fan the exact payload out to every card.commented/card_commented webhook.
// Runs fully offline: db and pubsub are replaced with an in-memory fake.
import { describe, expect, it, mock } from 'bun:test';
import type { Knex } from 'knex';

// ── Module mocks (must be registered before importing the modules under test) ──

type Row = Record<string, unknown>;

// Any table the comment-creation flow touches (directly or via imports).
const KNOWN_TABLES = [
  'cards',
  'lists',
  'boards',
  'comments',
  'card_members',
  'checklist_items',
  'users',
  'activities',
  'events',
  'mentions',
  'notifications',
  'webhooks',
] as const;

const state: Record<(typeof KNOWN_TABLES)[number], Row[]> = Object.fromEntries(
  KNOWN_TABLES.map((name) => [name, []])
) as Record<(typeof KNOWN_TABLES)[number], Row[]>;

function table(name: string): Row[] {
  if ((KNOWN_TABLES as readonly string[]).includes(name)) {
    return state[name as (typeof KNOWN_TABLES)[number]];
  }
  // [why] The handler passes the transaction handle through too; accept it as
  // a valid (comments-backed) table to keep the fake permissive.
  return state.comments;
}

// Minimal chainable knex-like query builder over the in-memory state.
// [why] The chainable no-op methods intentionally ignore their arguments — they
// exist only to satisfy the knex call shapes the handler uses.
/* eslint-disable @typescript-eslint/no-unused-vars */
function builder(name: string): Record<string, unknown> {
  const rows = table(name);
  const api = {
    _rows: rows,
    where(_cond: Row | string, _value?: unknown) {
      return this;
    },
    orWhere(_col: string, _value: unknown) {
      return this;
    },
    whereNotNull(_col: string) {
      return this;
    },
    whereIn(_col: string, _values: unknown[]) {
      return this;
    },
    join(_join: string, _on: string) {
      return this;
    },
    leftJoin(_table: string, _a: string, _b: string) {
      return this;
    },
    select(..._cols: unknown[]) {
      return this;
    },
    // [why] knex builders are thenable and resolve to row arrays — mirror that so
    // callers can await queries directly (e.g. inside Promise.all).
    then(onFulfilled?: (rows: Row[]) => unknown, onRejected?: (err: unknown) => unknown) {
      return Promise.resolve([...rows]).then(onFulfilled, onRejected);
    },
    first() {
      return Promise.resolve(rows[0] ?? undefined);
    },
    pluck(_col: string) {
      return Promise.resolve([] as unknown[]);
    },
    insert(row: Row, _returning?: unknown) {
      // [why] Postgres jsonb round-trip: the caller stringifies payloads on write and
      // the pg driver hands back a parsed object on read — mimic that here, and
      // synthesize the events table's bigserial sequence/created_at columns.
      const stored: Row = { ...row };
      if (typeof stored.payload === 'string') {
        stored.payload = JSON.parse(stored.payload as string) as unknown;
      }
      if ('entity_id' in stored && !('sequence' in stored)) {
        stored.sequence = BigInt(rows.length + 1);
        stored.created_at = new Date().toISOString();
      }
      rows.push(stored);
      return Promise.resolve([stored]) as unknown as Record<string, unknown>;
    },
  };
  return api;
}

const fakeDb = (() => {
  const dbFn = (name: string) => builder(name);
  (
    dbFn as unknown as {
      transaction: (cb: (trx: unknown) => Promise<void>) => Promise<void>;
    }
  ).transaction = async (cb) => {
    // trx must be callable (trx('table')) — build a function carrying the builder API.
    const trx = Object.assign((tableName: string) => builder(tableName), builder('__trx__'));
    await cb(trx);
  };
  (dbFn as unknown as { raw: (sql: string) => unknown }).raw = (sql: string) => ({ __raw: sql });
  return dbFn as unknown as Knex;
})();

mock.module('../../../../../server/common/db', () => ({ db: fakeDb }));

const published: Array<{ channel: string; message: string }> = [];
mock.module('../../../../../server/mods/pubsub/publisher', () => ({
  publisher: {
    publish: (channel: string, message: string) => {
      published.push({ channel, message });
      return Promise.resolve();
    },
  },
}));

// Capture webhook dispatches — the contract under test.
// [why] Import the real modules BEFORE mocking and snapshot the original functions:
// bun's mock.module is process-global, so the mock must pass through to the real
// implementation whenever it is called with a foreign knex instance — otherwise
// unrelated suites in the same full-suite process (e.g. webhooks dispatch tests)
// would observe the mock and fail (cross-file mock bleed).
const realWebhookDispatchModule =
  await import('../../../../../server/extensions/webhooks/mods/dispatch');
const realDispatchWebhook = realWebhookDispatchModule.dispatchWebhook;
const webhookDispatches: Array<{ eventType: string; payload: Row }> = [];
mock.module('../../../../../server/extensions/webhooks/mods/dispatch', () => ({
  dispatchWebhook: (input: { eventType: string; payload: Row; knex: unknown }) => {
    if (input.knex !== fakeDb) return realDispatchWebhook(input);
    webhookDispatches.push({ eventType: input.eventType, payload: input.payload });
    return Promise.resolve();
  },
}));

// [why] Same passthrough pattern for the registry: fake-db callers get deterministic
// subscribers (dot + underscore alias) so fanout/dedupe is observable; everyone else
// hits the real registry.
const realRegistryModule = await import('../../../../../server/extensions/webhooks/mods/registry');
const realGetActiveWebhooksForEvent = realRegistryModule.getActiveWebhooksForEvent;
mock.module('../../../../../server/extensions/webhooks/mods/registry', () => ({
  getActiveWebhooksForEvent: (input: { knex: unknown; eventType: string }) => {
    if (input.knex !== fakeDb) return realGetActiveWebhooksForEvent(input);
    return Promise.resolve([
      {
        id: `wh-${input.eventType}`,
        created_by: 'u-system',
        label: `bridge-${input.eventType}`,
        endpoint_url: 'https://bridge.example.test/hook',
        signing_secret: 'test-secret',
        event_types: [input.eventType],
        is_active: true,
      },
    ]);
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-1';
const BOARD_ID = 'board-1';
const BOARD_TITLE = 'AutoBag';
const CARD_ID = 'card-1';
const CARD_TITLE = 'Fix login flow';
const ACTOR_ID = 'u-actor';
const CARD_ASSIGNEE = 'u-card-assignee';
const CHECKLIST_ASSIGNEE = 'u-checklist-assignee';
const REPLY_TARGET = 'u-reply-target';

function seedBaseState(): void {
  for (const rows of Object.values(state)) rows.length = 0;

  state.boards.push({
    id: BOARD_ID,
    workspace_id: WORKSPACE_ID,
    state: 'ACTIVE',
    title: BOARD_TITLE,
  });
  state.lists.push({ id: 'list-1', board_id: BOARD_ID });
  state.cards.push({ id: CARD_ID, list_id: 'list-1', title: CARD_TITLE });
  state.card_members.push({ card_id: CARD_ID, user_id: CARD_ASSIGNEE });
  state.checklist_items.push({ card_id: CARD_ID, assigned_member_id: CHECKLIST_ASSIGNEE });
  state.users.push({ id: ACTOR_ID, name: 'Test Actor', nickname: null });
}

function makeRequest(body: Row): Request {
  return new Request(`http://localhost/api/v1/cards/${CARD_ID}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Request & { currentUser?: { id: string; email: string } };
}

// The auth + permission middlewares read these via the mocked modules below;
// handler auth is bypassed because authenticate() is overridden to resolve
// the injected current user.
const CURRENT_USER = { id: ACTOR_ID, email: 'actor@example.test' };

mock.module('../../../../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: async (req: { currentUser?: { id: string; email: string } }) => {
    (req as { currentUser?: { id: string; email: string } }).currentUser = CURRENT_USER;
    return null;
  },
}));

mock.module('../../../../../server/middlewares/permissionManager', () => ({
  requireWorkspaceMembership: async () => null,
  requireMemberOrBoardGuestMember: async () => null,
}));

mock.module('../../../../../server/common/ids/resolveEntityId', () => ({
  resolveCardId: async (identifier: string) => (identifier === CARD_ID ? CARD_ID : null),
}));

mock.module('../../../../../server/common/ids/shortId', () => ({
  generateUniqueShortId: async () => 'sh0rtId1',
}));

mock.module('../../../../../server/common/mentions/sync', () => ({
  syncMentions: async () => ({ addedUserIds: [] }),
}));

mock.module('../../../../../server/extensions/notifications/mods/createNotifications', () => ({
  createNotificationsForMentions: async () => {},
}));

mock.module('../../../../../server/extensions/notifications/mods/boardActivityDispatch', () => ({
  dispatchDirectCardNotification: async () => {},
  handleBoardActivityNotification: async () => {},
}));

mock.module('../../../../../server/config/env', () => ({
  env: {
    WEBHOOKS_ENABLED: true,
    NOTIFICATION_PREFERENCES_ENABLED: false,
  },
}));

// [why] Snapshot the REAL avatar module before overriding: bun's mock.module is
// process-global, so the override must forward every other export untouched —
// otherwise later test files in the same process (e.g. the eventId dispatch
// suite) break on missing named exports (cross-file mock bleed).
const realAvatarModule = await import('../../../../../server/common/avatar/resolveAvatarUrl');
mock.module('../../../../../server/common/avatar/resolveAvatarUrl', () => ({
  ...realAvatarModule,
  buildAvatarProxyUrl: ({ avatarUrl }: { avatarUrl: string | null }) =>
    avatarUrl ? '/api/v1/users/u/avatar' : null,
}));

const flush = () => new Promise((r) => setTimeout(r, 50));

// [why] Import the REAL dispatch module alongside the mocks: bun's mock.module is
// process-global, and without a real-path import here the dispatcher loaded by
// another test file in the same full-suite process would keep the mocked
// dispatchWebhook — breaking unrelated suites (cross-file mock bleed).
await import('../../../../../server/mods/events/dispatch');
// [why] Loaded after all mock.module registrations so the handler resolves the
// mocked db/auth/mentions/notification modules.
const { handleCreateComment } = await import('../../../../../server/extensions/comment/api/create');

/** Latest captured comment payload with the given legacy commentId, if any. */
function capturedCommentPayload(): Record<string, unknown> | undefined {
  for (let i = webhookDispatches.length - 1; i >= 0; i -= 1) {
    const candidate = webhookDispatches[i].payload as Record<string, unknown>;
    if (candidate && typeof candidate.commentId === 'string') return candidate;
  }
  return undefined;
}

// ── Contract tests ───────────────────────────────────────────────────────────

describe('handleCreateComment → card.commented intervention contract', () => {
  it('dispatches interventionUserIds with assignees + reply target, minus actor and mentioned, plus display fields', async () => {
    seedBaseState();
    webhookDispatches.length = 0;

    const response = await handleCreateComment(makeRequest({ content: 'Please review' }), CARD_ID);
    expect(response.status).toBe(201);

    await flush();

    const payload = capturedCommentPayload();
    expect(payload).toBeDefined();

    // Legacy fields preserved
    expect(payload!.commentId).toBeTypeOf('string');
    expect(payload!.cardId).toBe(CARD_ID);
    expect(payload!.cardTitle).toBe(CARD_TITLE);
    expect(payload!.boardId).toBe(BOARD_ID);
    expect(payload!.entityId).toBe(CARD_ID);
    expect(payload!.actorId).toBe(ACTOR_ID);

    // New intervention contract
    expect((payload!.interventionUserIds as string[]).sort()).toEqual(
      [CARD_ASSIGNEE, CHECKLIST_ASSIGNEE].sort()
    );
    expect(payload!.boardTitle).toBe(BOARD_TITLE);
    // [why] canonical preview semantics: plain text passes through unchanged
    expect(payload!.sourcePreview).toBe('Please review');
    expect(payload!.actorName).toBe('Test Actor');
    expect((payload!.actorName as string).includes('@')).toBe(false);
    // [why] durable producer event identity (ADR chimedeck-whatsapp-dedupe-contract):
    // the persisted events.id so the receiver can semantically dedupe re-signed retries
    expect(typeof payload!.eventId).toBe('string');
    expect((payload!.eventId as string).length).toBeGreaterThan(0);
  });

  it('includes the reply target for threaded replies', async () => {
    seedBaseState();
    // Parent comment authored by the reply target
    state.comments.push({
      id: 'parent-1',
      card_id: CARD_ID,
      user_id: REPLY_TARGET,
      content: 'original',
      parent_id: null,
    });
    webhookDispatches.length = 0;

    const response = await handleCreateComment(
      makeRequest({ content: 'a reply', parent_id: 'parent-1' }),
      CARD_ID
    );
    expect(response.status).toBe(201);
    await flush();

    const payload = capturedCommentPayload();
    expect(payload).toBeDefined();
    expect((payload!.interventionUserIds as string[]).sort()).toEqual(
      [CARD_ASSIGNEE, CHECKLIST_ASSIGNEE, REPLY_TARGET].sort()
    );
  });

  it('self comment on a fully self-assigned card dispatches no interventionUserIds', async () => {
    seedBaseState();
    // Self comment: actor is the only assignee → no intervention targets.
    state.card_members.length = 0;
    state.checklist_items.length = 0;
    state.card_members.push({ card_id: CARD_ID, user_id: ACTOR_ID });
    webhookDispatches.length = 0;

    const response = await handleCreateComment(makeRequest({ content: 'note to self' }), CARD_ID);
    expect(response.status).toBe(201);
    await flush();

    const payload = capturedCommentPayload();
    expect(payload).toBeDefined();
    expect('interventionUserIds' in payload!).toBe(false);
  });

  it('fans the identical payload out to both card.commented and card_commented alias subscribers', async () => {
    seedBaseState();
    webhookDispatches.length = 0;

    await handleCreateComment(makeRequest({ content: 'alias check' }), CARD_ID);
    await flush();

    const types = webhookDispatches.map((d) => d.eventType).sort();
    expect(types).toEqual(['card.commented', 'card_commented']);
    const dot = webhookDispatches.find((d) => d.eventType === 'card.commented')!;
    const underscore = webhookDispatches.find((d) => d.eventType === 'card_commented')!;
    expect(underscore.payload).toEqual(dot.payload);
    // The exact captured payload must be what every alias receives.
    expect(dot.payload).toEqual(capturedCommentPayload());
  });
});
