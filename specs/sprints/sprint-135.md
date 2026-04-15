# Sprint 135 — Webhooks: DB + API Infrastructure

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 101 (API Token Infrastructure — establishes `api_tokens` and authenticate middleware patterns)

---

## Goal

Build the server-side foundation for outgoing webhooks. Workspace members can register HTTP endpoints that the platform calls whenever matching events occur on a card. Each registration is scoped to a workspace and carries a HMAC-SHA256 signing secret so the receiving server can verify authenticity.

---

## Webhook Event Types

All event types a subscriber can listen to:

| Event type | Trigger |
|---|---|
| `card.created` | Card created in any board of the workspace |
| `card.updated` | Any field on the card changed (title, description, etc.) |
| `card.deleted` | Card permanently deleted |
| `card.archived` | Card archived |
| `card.description_edited` | Card description specifically edited |
| `card.attachment_added` | Attachment added to a card |
| `card.member_assigned` | Member assigned to a card |
| `card.member_removed` | Member removed from a card |
| `card.commented` | Comment added to a card |
| `card.moved` | Card moved between lists or boards |
| `mention` | User mentioned in a comment or description |
| `board.created` | A board is created in a workspace the subscriber belongs to **and** the subscriber has access to that board (private boards the user cannot see are excluded) |
| `board.member_added` | The subscribing user is added to a board |
| `card_created` | Alias retained for parity with notification system |
| `card_moved` | Alias retained for parity with notification system |
| `card_commented` | Alias retained for parity with notification system |
| `card_member_assigned` | Alias retained for parity with notification system |
| `card_member_unassigned` | Member removed (notification-system alias) |
| `card_updated` | Alias retained for parity with notification system |
| `card_deleted` | Alias retained for parity with notification system |
| `card_archived` | Alias retained for parity with notification system |

> Implementation tip: store a canonical `WEBHOOK_EVENT_TYPES` constant array in `server/extensions/webhooks/common/eventTypes.ts` so the DB CHECK constraint and the API validation share a single source of truth.

---

## Signature Scheme

All outgoing webhook requests include the header:

```
Webhook-Signature: t=<unix_timestamp>,v0=<hex_hmac>
```

### Producing the signature (v0)

1. **Signed payload string** — concatenate: `<timestamp>.<raw_json_body>`
2. **HMAC** — `HMAC-SHA256(key=signingSecret, message=signedPayload)` → hex digest
3. **Header** — `t=<timestamp>,v0=<hmac_hex>`

### Security notes

- Ignore all scheme prefixes other than `v0` to prevent downgrade attacks.
- The timestamp is a Unix epoch integer (seconds). Reject events older than 5 minutes on the receiving side.

---

## Scope

### 1. DB Migration

**`db/migrations/0022_webhooks.ts`**

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('webhooks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    t.uuid('created_by').notNullable().references('id').inTable('users');
    t.string('label').notNullable();
    t.string('endpoint_url').notNullable();
    // [why] signing_secret stored AES-256-GCM encrypted (not plain text).
    // Hashing would prevent re-derivation for outgoing HMAC; encryption lets the server
    // decrypt at dispatch time while keeping the DB dump safe without the encryption key.
    t.text('signing_secret').notNullable();
    // [why] event_types stored as jsonb array — allows partial-index queries and future array operators.
    t.jsonb('event_types').notNullable().defaultTo('[]');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('webhook_deliveries', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('webhook_id').notNullable().references('id').inTable('webhooks').onDelete('CASCADE');
    t.string('event_type').notNullable();
    t.jsonb('payload').notNullable();
    t.integer('http_status').nullable();
    t.text('response_body').nullable();
    t.integer('attempt').notNullable().defaultTo(1);
    // [why] status enum covers the delivery lifecycle without extra joins
    t.enum('status', ['pending', 'delivered', 'failed']).notNullable().defaultTo('pending');
    t.timestamp('delivered_at').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('webhook_deliveries');
  await knex.schema.dropTableIfExists('webhooks');
}
```

---

### 2. Server extension layout

```
server/extensions/webhooks/
├── api/
│   └── index.ts          # mounts all webhook sub-routers
├── common/
│   └── eventTypes.ts     # WEBHOOK_EVENT_TYPES constant (single source of truth)
├── mods/
│   ├── sign.ts           # HMAC-SHA256 signing logic
│   ├── dispatch.ts       # fire-and-forget HTTP delivery + writes webhook_deliveries row
│   └── registry.ts       # getActiveWebhooksForEvent({ workspaceId, eventType })
└── api/
    ├── list.ts           # GET  /api/v1/webhooks
    ├── create.ts         # POST /api/v1/webhooks
    ├── update.ts         # PATCH /api/v1/webhooks/:id
    └── delete.ts         # DELETE /api/v1/webhooks/:id
```

Shared crypto utility (used by webhooks only for now, placed in common so other extensions can adopt it):

```
server/common/
└── crypto.ts             # encryptSecret / decryptSecret (AES-256-GCM)
```

---

### 3. `server/common/crypto.ts`

AES-256-GCM symmetric encryption for secrets that must be stored in the DB but re-read by the server at runtime (e.g. webhook signing secrets).

The key is sourced from `env.WEBHOOK_SECRET_ENCRYPTION_KEY` (64-char hex = 32 bytes). Generate with: `openssl rand -hex 32`.

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTE_LEN = 32;
const IV_BYTE_LEN = 12;  // 96-bit IV recommended for GCM
const TAG_BYTE_LEN = 16; // GCM auth tag length

function keyFromHex(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== KEY_BYTE_LEN) {
    throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return key;
}

/**
 * Encrypts a plaintext string and returns a single base64 string:
 *   base64(<iv:12 bytes> + <ciphertext> + <authTag:16 bytes>)
 */
export function encryptSecret({ plaintext, hexKey }: { plaintext: string; hexKey: string }): string {
  const key = keyFromHex(hexKey);
  const iv = randomBytes(IV_BYTE_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // [why] pack iv + ciphertext + tag into one field so the DB schema stays simple
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/**
 * Reverses encryptSecret. Throws if the auth tag does not match (tampered data).
 */
export function decryptSecret({ ciphertext, hexKey }: { ciphertext: string; hexKey: string }): string {
  const key = keyFromHex(hexKey);
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_BYTE_LEN);
  const tag = buf.subarray(buf.length - TAG_BYTE_LEN);
  const encrypted = buf.subarray(IV_BYTE_LEN, buf.length - TAG_BYTE_LEN);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

---

### 4. `eventTypes.ts`

```ts
// [why] single source of truth shared by DB constraint validation and API input guards
export const WEBHOOK_EVENT_TYPES = [
  'card.created',
  'card.updated',
  'card.deleted',
  'card.archived',
  'card.description_edited',
  'card.attachment_added',
  'card.member_assigned',
  'card.member_removed',
  'card.commented',
  'card.moved',
  'mention',
  // [why] board.created is dispatched only to subscribers who already have access
  // to the new board — prevents leaking private board existence
  'board.created',
  // [why] board.member_added is dispatched only to the newly added member
  'board.member_added',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
```

---

### 5. `sign.ts`

```ts
import { createHmac } from 'node:crypto';

export function signPayload({
  secret,
  timestamp,
  body,
}: {
  secret: string;
  timestamp: number;
  body: string;
}): string {
  const signedPayload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(signedPayload).digest('hex');
}

export function buildSignatureHeader({
  secret,
  body,
}: {
  secret: string;
  body: string;
}): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = signPayload({ secret, timestamp, body });
  return `t=${timestamp},v0=${sig}`;
}
```

---

### 6. `dispatch.ts`

`dispatch.ts` receives the **raw plaintext secret** (already decrypted by the caller before passing it in). The decryption happens in `registry.ts` after loading the row, keeping dispatch pure and testable.

```ts
// [why] fire-and-forget — webhook delivery must not block the originating request
export async function dispatchWebhook({
  endpoint,
  signingSecret,
  eventType,
  payload,
  webhookId,
  knex,
}: DispatchWebhookParams): Promise<void> {
  const body = JSON.stringify({ event: eventType, data: payload });
  const signature = buildSignatureHeader({ secret: signingSecret, body });

  const [deliveryId] = await knex('webhook_deliveries').insert({
    webhook_id: webhookId,
    event_type: eventType,
    payload,
    status: 'pending',
  }).returning('id');

  // [why] async IIFE so we never await the fetch at the call site
  (async () => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Webhook-Signature': signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      await knex('webhook_deliveries').where({ id: deliveryId }).update({
        status: res.ok ? 'delivered' : 'failed',
        http_status: res.status,
        response_body: (await res.text()).slice(0, 2000),
        delivered_at: new Date(),
      });
    } catch {
      await knex('webhook_deliveries').where({ id: deliveryId }).update({ status: 'failed' });
    }
  })();
}
```

---

### 7. `registry.ts`

`registry.ts` is responsible for decrypting the stored secret before returning the row, so call sites always work with plaintext secrets.

```ts
import { decryptSecret } from '../../common/crypto';
import { env } from '../../config/env';

// Returns all active webhooks for a workspace that subscribe to the given event type,
// with signing_secret already decrypted and ready for HMAC use.
export async function getActiveWebhooksForEvent({
  knex,
  workspaceId,
  eventType,
}: {
  knex: Knex;
  workspaceId: string;
  eventType: WebhookEventType;
}) {
  const rows = await knex('webhooks')
    .where({ workspace_id: workspaceId, is_active: true })
    .whereRaw(`event_types @> ?::jsonb`, [JSON.stringify([eventType])]);

  // [why] decrypt here so all callers receive a ready-to-use plaintext secret
  return rows.map((wh) => ({
    ...wh,
    signing_secret: decryptSecret({ ciphertext: wh.signing_secret, hexKey: env.WEBHOOK_SECRET_ENCRYPTION_KEY }),
  }));
}
```

---

### 8. REST endpoints

All routes require `authenticate` middleware. Only workspace members may manage webhooks.

#### `GET /api/v1/webhooks`

- Query param: `workspaceId` (required)
- Response:
```ts
{ data: WebhookItem[] }

interface WebhookItem {
  id: string;
  label: string;
  endpointUrl: string;
  eventTypes: WebhookEventType[];
  isActive: boolean;
  createdAt: string;
}
```
- `signing_secret` is **never** returned after initial creation.

#### `POST /api/v1/webhooks`

- Body:
```ts
{
  workspaceId: string;
  label: string;
  endpointUrl: string;          // must be https:// only (SSRF: reject private IP ranges)
  eventTypes: WebhookEventType[]; // non-empty, all values in WEBHOOK_EVENT_TYPES
}
```
- Generates a raw secret: `crypto.randomBytes(32).toString('hex')`.
- Encrypts it with `encryptSecret({ plaintext: rawSecret, hexKey: env.WEBHOOK_SECRET_ENCRYPTION_KEY })` before persisting.
- Response — the **raw** (pre-encryption) secret is returned **once only**:
```ts
{
  data: WebhookItem & { signingSecret: string }
}
```

#### `PATCH /api/v1/webhooks/:id`

- Body (all optional):
```ts
{ label?: string; endpointUrl?: string; eventTypes?: WebhookEventType[]; isActive?: boolean; }
```
- Caller must own the webhook (created_by) or be workspace OWNER/ADMIN.
- Response: `{ data: WebhookItem }`

#### `DELETE /api/v1/webhooks/:id`

- Requires authentication. Soft-cascade deletes related `webhook_deliveries`.
- Response: `{ data: {} }`

#### `GET /api/v1/webhooks/event-types`

- Public (authenticated) — returns the canonical event type list so the UI doesn't hard-code it.
- Response: `{ data: WebhookEventType[] }`

---

### 9. SSRF guard for endpoint URLs

In `create.ts` and `update.ts`, validate `endpointUrl`:

```ts
import { URL } from 'node:url';
import dns from 'node:dns/promises';

async function isEndpointAllowed(raw: string): Promise<boolean> {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return false; }
  if (parsed.protocol !== 'https:') return false;

  // [why] block SSRF to private / link-local / loopback ranges
  const BLOCKED = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1|fc00:|fd)/;
  const addresses = await dns.lookup(parsed.hostname, { all: true }).catch(() => []);
  return addresses.every(({ address }) => !BLOCKED.test(address));
}
```

---

### 10. Integrating dispatch into card event handlers

When card events fire (e.g. in `server/extensions/card/` route handlers), call `dispatchWebhook` after the DB write succeeds:

```ts
const webhooks = await getActiveWebhooksForEvent({
  knex, workspaceId, eventType: 'card.created',
});
for (const wh of webhooks) {
  dispatchWebhook({ endpoint: wh.endpoint_url, signingSecret: wh.signing_secret, ... });
}
```

Wire up initially for: `card.created`, `card.updated`, `card.deleted`, `card.archived`, `card.commented`, `card.member_assigned`, `card.member_removed`, `card.moved`.

#### `board.created` dispatch rules

Called from the board-creation handler **after** the board row is persisted. Fetch all workspace webhooks subscribed to `board.created`, then filter to only those whose `created_by` user has read access to the new board:

- If `visibility = 'PUBLIC'` or `'WORKSPACE'` — dispatch to all matching webhooks in the workspace.
- If `visibility = 'PRIVATE'` — dispatch only to webhooks whose owner is in the board's `board_members` table.

This prevents leaking the existence of private boards to users who cannot see them.

#### `board.member_added` dispatch rules

Called from the board-member-add handler after the member row is inserted. Dispatch only to webhooks registered by the **newly added user** (i.e. `webhooks.created_by = newMemberId`). Do not broadcast to all webhook owners in the workspace.

The remaining two (`card.description_edited`, `card.attachment_added`) are dispatched from their respective PATCH/POST handlers.

---

### 11. Feature flag + encryption key startup guard

`WEBHOOKS_ENABLED` (default `false` in local dev, `true` in staging/prod). When `false`, all `/api/v1/webhooks*` routes respond `501 Not Implemented`.

When `WEBHOOKS_ENABLED=true`, validate `WEBHOOK_SECRET_ENCRYPTION_KEY` at startup (in the router mount, before any request is served):

```ts
if (env.WEBHOOKS_ENABLED && env.WEBHOOK_SECRET_ENCRYPTION_KEY.length !== 64) {
  throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY must be set to a 64-char hex string when WEBHOOKS_ENABLED=true');
}
```

---

## Acceptance Criteria

- [ ] `webhooks` and `webhook_deliveries` tables exist after migration
- [ ] `signing_secret` column stores AES-256-GCM encrypted ciphertext (not plaintext)
- [ ] `POST /api/v1/webhooks` creates a record, returns raw `signingSecret` in response body once
- [ ] `GET /api/v1/webhooks?workspaceId=` returns list without `signing_secret`
- [ ] `PATCH /api/v1/webhooks/:id` updates mutable fields; permission-guarded
- [ ] `DELETE /api/v1/webhooks/:id` removes the webhook
- [ ] `GET /api/v1/webhooks/event-types` returns the canonical list
- [ ] `endpointUrl` must be `https://`; private IP ranges rejected (SSRF guard)
- [ ] Outgoing requests carry `Webhook-Signature: t=<ts>,v0=<hmac>` header
- [ ] `webhook_deliveries` row written for every dispatch attempt with final status
- [ ] `WEBHOOKS_ENABLED` flag gates all routes
- [ ] `WEBHOOKS_ENABLED=true` with missing/wrong-length key throws at startup
- [ ] Unit tests: `signPayload` correctness, `isEndpointAllowed` private-IP rejection, `encryptSecret`/`decryptSecret` round-trip

---

## Tests

| File | Coverage |
|---|---|
| `tests/unit/webhooks/sign.test.ts` | Signature matches known vector; `buildSignatureHeader` format |
| `tests/unit/webhooks/isEndpointAllowed.test.ts` | Accepts `https://example.com`, rejects `http://`, `192.168.*`, `127.0.0.1`, `10.*` |
| `tests/unit/common/crypto.test.ts` | `encryptSecret`/`decryptSecret` round-trip; wrong key throws; tampered ciphertext throws |
| `tests/integration/webhooks/crud.test.ts` | Create → list → patch → delete lifecycle |
| `tests/integration/webhooks/dispatch.test.ts` | Mock HTTP server receives signed POST; delivery row updated |
