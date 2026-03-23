# Sprint 101 — API Token Infrastructure (DB + Server)

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 2 (Auth — JWT login), Sprint 15 (User profile)

---

## Goal

Allow users to generate long-lived API tokens that can authenticate against the Horiflow API — independently of the session-based JWT flow. These tokens power the MCP server (Sprint 104) and the CLI (Sprint 105).

A token is:
- A securely random 32-byte value encoded as hex (64 chars), prefixed with `hf_` to make it visually identifiable.
- Stored as a SHA-256 hash; the raw value is returned **once** at creation and never retrievable again.
- Optionally expirable (`expires_at`); if `null` the token never expires.
- Revokable at any time by the owner (soft-delete via `revoked_at`).

The existing `authenticate` middleware is extended to accept a valid API token in the `Authorization: Bearer <value>` header as an alternative to a JWT access token.

---

## Acceptance Criteria

- [ ] `api_tokens` table exists with correct columns, indexes, and constraints
- [ ] `POST /api/v1/tokens` creates a token, returns the raw value once
- [ ] `GET /api/v1/tokens` returns all non-revoked tokens for the current user (no raw values)
- [ ] `DELETE /api/v1/tokens/:id` revokes a token (sets `revoked_at`)
- [ ] `authenticate` middleware accepts both JWT access tokens and valid API tokens
- [ ] Expired tokens are rejected with 401
- [ ] Revoked tokens are rejected with 401
- [ ] Token belonging to another user cannot be used to authenticate as that user (no cross-user attack)

---

## Scope

### 1. DB Migration `0093_api_tokens.ts`

```ts
await knex.schema.createTable('api_tokens', (table) => {
  table.string('id').primary();                          // nanoid
  table.string('user_id').notNullable()
    .references('id').inTable('users').onDelete('CASCADE');
  table.string('name').notNullable();                    // user-supplied label
  table.string('token_hash').notNullable().unique();     // SHA-256 of raw token
  table.string('token_prefix', 10).notNullable();        // first 8 chars of raw token for display
  table.timestamp('expires_at', { useTz: true }).nullable();
  table.timestamp('last_used_at', { useTz: true }).nullable();
  table.timestamp('revoked_at', { useTz: true }).nullable();
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  table.index(['user_id']);
  table.index(['token_hash']);
});
```

---

### 2. Token generation helper

**`server/extensions/apiToken/mods/generate.ts`**

```ts
// Generates a cryptographically random API token in the format hf_<64hex>.
// Returns { raw, hash, prefix } — only `hash` and `prefix` are persisted.
export function generateApiToken(): { raw: string; hash: string; prefix: string }
```

- Raw: `hf_` + 32 random bytes as lowercase hex (67 chars total)
- Hash: `SHA-256(raw)` as hex — use `crypto.subtle.digest`
- Prefix: first 10 chars of `raw` (e.g. `hf_3a7b9c`) — stored for display so users can identify a token without storing the secret

---

### 3. Server — API Token CRUD

**`server/extensions/apiToken/api/`**

```
apiToken/api/
  index.ts      # mounts POST, GET, DELETE
  create.ts     # POST /api/v1/tokens
  list.ts       # GET  /api/v1/tokens
  revoke.ts     # DELETE /api/v1/tokens/:id
```

#### `POST /api/v1/tokens`

Body:
```ts
{ name: string; expiresAt?: string | null } // ISO timestamp or null = never
```

Response (raw token returned exactly once):
```ts
{
  data: {
    id: string;
    name: string;
    token: string;   // raw hf_... value — shown once
    prefix: string;
    expiresAt: string | null;
    createdAt: string;
  }
}
```

#### `GET /api/v1/tokens`

Returns non-revoked tokens for the authenticated user. Never returns `token_hash` or raw value.

```ts
{
  data: Array<{
    id: string;
    name: string;
    prefix: string;
    expiresAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
  }>
}
```

#### `DELETE /api/v1/tokens/:id`

Sets `revoked_at = now()`. Returns `{ data: {} }`. Returns 404 if token does not belong to the current user.

---

### 4. Extend `authenticate` middleware

**`server/extensions/auth/middlewares/authentication.ts`**

Current flow: verify JWT → populate `req.currentUser`.

Extended flow:
1. Extract `Bearer <value>` from `Authorization` header.
2. If the value starts with `hf_`: look up `api_tokens` by `SHA-256(value)`.
   - Reject if not found, revoked, or expired.
   - Update `last_used_at = now()`.
   - Populate `req.currentUser` with the token's `user_id`.
3. Otherwise: treat as JWT (existing path, unchanged).

> [why] Keeping the detection in the existing `authenticate` middleware means every existing protected route automatically accepts API tokens without any per-route changes.

---

### 5. Mount the router

**`server/extensions/apiToken/api/index.ts`** mounts at `/api/v1/tokens` inside the main server router.

---

## File Checklist

| File | Change |
|------|--------|
| `db/migrations/0093_api_tokens.ts` | New migration |
| `server/extensions/apiToken/mods/generate.ts` | Token generation helper |
| `server/extensions/apiToken/api/create.ts` | POST /api/v1/tokens |
| `server/extensions/apiToken/api/list.ts` | GET /api/v1/tokens |
| `server/extensions/apiToken/api/revoke.ts` | DELETE /api/v1/tokens/:id |
| `server/extensions/apiToken/api/index.ts` | Mount routes |
| `server/extensions/auth/middlewares/authentication.ts` | Extend to accept API tokens |
| `server/index.ts` | Mount apiToken router |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | POST /api/v1/tokens with name + expiresAt | 201; response contains raw `hf_...` token |
| T2 | GET /api/v1/tokens | Returns list, no raw token in response |
| T3 | DELETE /api/v1/tokens/:id | Token revoked; subsequent Bearer request returns 401 |
| T4 | API request with valid `hf_...` token | 200; `req.currentUser` populated correctly |
| T5 | Expired token used | 401 |
| T6 | Revoked token used | 401 |
| T7 | Token belonging to another user | 401 or 404 — cannot impersonate |
| T8 | DELETE token owned by another user | 404 |
