# Sprint 142 — Smart Links: Connected Account Infrastructure

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 101 (API Token Infrastructure — authenticate middleware), Sprint 03 (Auth — user identity)

---

## Goal

Build the server-side foundation for Smart Links. When a user pastes a URL from a supported service (Google Workspace, Figma, Slack, Dropbox, Box, Microsoft, Salesforce, GitHub), the platform fetches rich metadata (file name, document title, PR status, etc.) on their behalf and returns it via a single resolution endpoint.

Because most of these services gate metadata behind OAuth, the platform manages per-user OAuth connections. If the user has not yet connected an account for a given provider, the resolve endpoint signals that a connection is required — the client (Sprint 143) will then show a "Connect [Service]" prompt inline.

A shared **cache table** prevents redundant upstream API calls. Tokens are stored encrypted at rest with AES-256-GCM.

---

## Supported Providers

| Provider key | Handles | Auth required |
|---|---|---|
| `google` | Google Docs, Sheets, Slides, Drive folders | Yes (OAuth2) |
| `figma` | Figma files, FigJam files, project previews | Yes (OAuth2) |
| `slack` | Public / private channel links, message permalinks | Yes (OAuth2) |
| `dropbox` | File and folder names, last-modified data | Yes (OAuth2) |
| `box` | File names, last-modified data | Yes (OAuth2) |
| `microsoft` | OneDrive files, SharePoint document titles | Yes (OAuth2 — MSAL) |
| `salesforce` | Opportunity, Contact, Lead names | Yes (OAuth2) |
| `github` | Public repo names, issue titles, PR statuses | Public repos: open-graph fallback; Private: OAuth |

---

## Feature Flag

| Flag | Scope | Default | Effect when off |
|---|---|---|---|
| `SMART_LINKS_ENABLED` | Server env flag | `false` | All `/api/v1/smart-links/*` routes return `501 Not Implemented`; feature unavailable for everyone |
| `smart_links_opt_in` | Per-user DB column | `true` | When `false` for a given user, smart link resolution and connect prompts are suppressed for that user only; all URLs render via the existing plain-link pipeline |

Add `SMART_LINKS_ENABLED` to `server/config/flags.ts`.

The per-user flag lets individual users opt out without affecting anyone else. It defaults to `true` so the feature is active for all users on first deploy.

---

## Environment Variables (add to `server/config/index.ts`)

```
SMART_LINKS_GOOGLE_CLIENT_ID
SMART_LINKS_GOOGLE_CLIENT_SECRET
SMART_LINKS_FIGMA_CLIENT_ID
SMART_LINKS_FIGMA_CLIENT_SECRET
SMART_LINKS_SLACK_CLIENT_ID
SMART_LINKS_SLACK_CLIENT_SECRET
SMART_LINKS_DROPBOX_APP_KEY
SMART_LINKS_DROPBOX_APP_SECRET
SMART_LINKS_BOX_CLIENT_ID
SMART_LINKS_BOX_CLIENT_SECRET
SMART_LINKS_MICROSOFT_CLIENT_ID
SMART_LINKS_MICROSOFT_CLIENT_SECRET
SMART_LINKS_MICROSOFT_TENANT_ID    (default: "common" for multi-tenant)
SMART_LINKS_SALESFORCE_CLIENT_ID
SMART_LINKS_SALESFORCE_CLIENT_SECRET
SMART_LINKS_SALESFORCE_LOGIN_URL   (default: "https://login.salesforce.com")
SMART_LINKS_GITHUB_CLIENT_ID
SMART_LINKS_GITHUB_CLIENT_SECRET
SMART_LINKS_TOKEN_ENCRYPTION_KEY   (32-byte hex — used for AES-256-GCM token storage)
SMART_LINKS_CACHE_TTL_SECONDS      (default: 300 — 5-minute cache)
SMART_LINKS_APP_BASE_URL           (used to construct OAuth callback URLs)
```

---

## DB Migrations

### `db/migrations/0118_smart_links.ts`

```ts
export async function up(knex: Knex): Promise<void> {
  // [why] one row per user per provider; tokens encrypted before insert
  await knex.schema.createTable('user_connected_accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    // [why] provider + user_id unique — each user connects each provider at most once
    t.string('provider').notNullable();
    t.text('access_token_enc').notNullable();   // AES-256-GCM encrypted
    t.text('refresh_token_enc').nullable();      // null for providers without refresh tokens
    t.timestamp('token_expires_at').nullable();  // null = non-expiring
    t.text('scope').nullable();                  // space-separated granted scopes
    t.string('provider_user_id').nullable();     // provider-side user identifier
    t.string('provider_display_name').nullable();// e.g. "Alice (alice@example.com)"
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['user_id', 'provider']);
  });

  // [why] cache reduces redundant upstream API calls for the same URL within TTL window
  await knex.schema.createTable('smart_link_cache', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    // [why] sha256 of the normalized URL — indexed for fast lookup without storing full URL in index
    t.string('url_hash', 64).notNullable().unique();
    t.text('url').notNullable();
    t.string('provider').nullable();            // null = provider unrecognised (open-graph fallback)
    t.string('title').nullable();
    t.string('subtitle').nullable();            // e.g. last modified, channel name, PR status
    t.string('icon_url').nullable();
    t.string('link_type').nullable();           // e.g. "Google Doc", "Figma File", "Pull Request"
    t.boolean('requires_connection').notNullable().defaultTo(false);
    t.timestamp('fetched_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('expires_at').notNullable();
  });

  await knex.schema.raw(
    `CREATE INDEX idx_smart_link_cache_expires ON smart_link_cache (expires_at)`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('smart_link_cache');
  await knex.schema.dropTableIfExists('user_connected_accounts');
}
```

### `db/migrations/0119_smart_links_user_prefs.ts`

```ts
export async function up(knex: Knex): Promise<void> {
  // [why] Single boolean on users table — avoids a join for a per-user toggle.
  // Default true: feature is on for everyone on first deploy; users opt out individually.
  await knex.schema.alterTable('users', (t) => {
    t.boolean('smart_links_opt_in').notNullable().defaultTo(true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('smart_links_opt_in');
  });
}
```

---

## Folder / File Layout

```
server/extensions/smartLinks/
├── api/
│   ├── index.ts                    ← mount all routes under /api/v1/smart-links
│   ├── providers.ts               ← GET /providers
│   ├── connect.ts                 ← GET /connect/:provider  (redirect to OAuth)
│   ├── callback.ts                ← GET /callback/:provider (handle OAuth code)
│   ├── disconnect.ts              ← DELETE /connect/:provider
│   └── resolve.ts                 ← POST /resolve
├── common/
│   ├── config/
│   │   └── providers.ts           ← OAuth config map per provider key
│   ├── encryption.ts              ← AES-256-GCM encrypt/decrypt for token storage
│   ├── cache.ts                   ← read / write / invalidate smart_link_cache rows
│   └── urlNormalize.ts            ← strip tracking params, normalise URL before hashing
├── providers/
│   ├── index.ts                   ← provider registry (map key → handler module)
│   ├── google.ts
│   ├── figma.ts
│   ├── slack.ts
│   ├── dropbox.ts
│   ├── box.ts
│   ├── microsoft.ts
│   ├── salesforce.ts
│   └── github.ts
└── index.ts                       ← register routes + flag guard
```

---

## Scope

### 1. Provider Config — `common/config/providers.ts`

Each provider entry:

```ts
interface ProviderConfig {
  key: string;
  displayName: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  logoUrl: string;         // served from /public/sdk/ or external CDN
  urlPatterns: RegExp[];   // used server-side to classify incoming URLs
}
```

The `urlPatterns` array lets `resolve.ts` and each provider module identify which URLs belong to that provider without an upstream call.

---

### 2. Encryption — `common/encryption.ts`

AES-256-GCM using `SMART_LINKS_TOKEN_ENCRYPTION_KEY` from config.

```ts
export function encrypt(plaintext: string): string  // returns "<iv_hex>:<ciphertext_hex>:<tag_hex>"
export function decrypt(ciphertext: string): string
```

> Never log plaintext tokens. The key must be rotated via a migration if compromised.

---

### 3. Cache — `common/cache.ts`

```ts
export async function getCached({ urlHash }): Promise<SmartLinkCacheRow | null>
export async function setCache({ url, urlHash, provider, title, subtitle, iconUrl, linkType, requiresConnection }): Promise<void>
export async function bustCache({ urlHash }): Promise<void>
```

TTL = `SMART_LINKS_CACHE_TTL_SECONDS` (default 300 s). The `expires_at` column drives a background cleanup worker (simple `DELETE WHERE expires_at < NOW()` on a 5-minute interval using Bun's `setInterval`).

---

### 4. Provider Modules — `providers/<provider>.ts`

Each module exports:

```ts
interface ProviderModule {
  // Return true if this module should handle the given URL
  matches(url: string): boolean;

  // Attempt to resolve metadata using the user's connected account tokens.
  // Returns null if no connected account found for the user.
  resolve({ url, userId, db }): Promise<SmartLinkMeta | null>;

  // Build the OAuth authorization URL for this provider.
  buildAuthUrl({ state, redirectUri }): string;

  // Exchange an OAuth code for tokens; persist to user_connected_accounts.
  handleCallback({ code, state, redirectUri, userId, db }): Promise<void>;
}

interface SmartLinkMeta {
  title: string | null;
  subtitle: string | null;   // e.g. "Last modified 3 days ago", "Open · 5 comments"
  iconUrl: string | null;
  linkType: string;           // human-readable: "Google Doc", "Pull Request", etc.
  requiresConnection: false;
}
```

**Fallback for `github.ts`:** Public repositories, issues, and PRs are accessible via the GitHub REST API without a token. The module calls `GET /repos/:owner/:repo` unauthenticated first. If the response is 404 (private repo), it falls back to `requiresConnection: true`.

**Fallback for all providers:** If the user has no connected account, return:
```ts
{ title: null, subtitle: null, iconUrl: null, linkType: "<Provider> <Type>", requiresConnection: true }
```

---

### 5. API Routes

#### `GET /api/v1/smart-links/providers`

Returns all supported providers and the current user's connection status.

**Response:**
```json
{
  "data": [
    {
      "key": "google",
      "displayName": "Google Workspace",
      "logoUrl": "/sdk/icons/google.svg",
      "configured": true,
      "connected": true,
      "providerDisplayName": "Alice (alice@gmail.com)"
    },
    {
      "key": "github",
      "displayName": "GitHub",
      "logoUrl": "/sdk/icons/github.svg",
      "configured": true,
      "connected": false,
      "providerDisplayName": null
    },
    {
      "key": "salesforce",
      "displayName": "Salesforce",
      "logoUrl": "/sdk/icons/salesforce.svg",
      "configured": false,
      "connected": false,
      "providerDisplayName": null
    }
  ],
  "metadata": {
    "userOptIn": true
  }
}
```

`configured: false` means the server does not have OAuth credentials for that provider (env vars missing). The client must not show a "Connect your [Platform] account" prompt for unconfigured providers — the URL is treated as an unrecognised link and falls back to the old plain-link behaviour.

`metadata.userOptIn` reflects the current user's `smart_links_opt_in` value. The client uses this to decide whether to activate the smart links pipeline at all for this user.

#### `GET /api/v1/smart-links/connect/:provider`

Initiates the OAuth flow. Generates a CSRF `state` token (stored server-side in a short-lived cache keyed by `state`), then redirects to the provider's authorization URL.

**Security:** The `state` parameter binds the callback to the initiating user session. Validate `state` on callback; reject mismatches.

#### `GET /api/v1/smart-links/callback/:provider`

Handles the OAuth redirect. Validates `state`, exchanges `code` for tokens, encrypts and upserts into `user_connected_accounts`, then redirects back to the client (e.g. `/settings/connections?connected=google`).

#### `GET /api/v1/smart-links/preference`

Returns the current user's opt-in status.

**Response:** `{ "data": { "optIn": true } }`

#### `PATCH /api/v1/smart-links/preference`

**Body:** `{ "optIn": false }`

Updates `smart_links_opt_in` on the current user's row.

**Response:** `{ "data": { "optIn": false } }`

#### `DELETE /api/v1/smart-links/connect/:provider`

Deletes the user's `user_connected_accounts` row for the given provider.

**Response:** `{ "data": {} }`

#### `POST /api/v1/smart-links/resolve`

**Body:** `{ "url": "https://docs.google.com/document/d/..." }`

Resolution order:
1. **Check `smart_links_opt_in`** — if the current user has opted out, return `{ data: null }` immediately (no cache read, no upstream call).
2. Normalise URL → compute `sha256` hash.
3. Check `smart_link_cache` — if hit and not expired, return cached row.
4. Classify URL against provider `urlPatterns`.
5. If provider recognised: call `provider.resolve({ url, userId, db })`.
6. If no connected account (`requiresConnection: true`): cache with short TTL (30 s), return `requires_connection`.
7. On successful fetch: cache with full TTL, return metadata.
8. If provider unrecognised: attempt open-graph title scrape as final fallback.

**SSRF Prevention:** Before making any outbound HTTP request, validate the resolved IP is not in a private range (RFC1918, loopback, link-local, APIPA). Reject requests to `localhost`, `127.*`, `10.*`, `172.16-31.*`, `192.168.*`, `169.254.*`, and `::1`.

**Response (resolved):**
```json
{
  "data": {
    "url": "https://docs.google.com/document/d/...",
    "provider": "google",
    "title": "Q4 Marketing Strategy",
    "subtitle": "Last modified 2 days ago",
    "iconUrl": "/sdk/icons/google-doc.svg",
    "linkType": "Google Doc",
    "requiresConnection": false
  }
}
```

**Response (connection required):**
```json
{
  "data": {
    "url": "https://app.slack.com/...",
    "provider": "slack",
    "title": null,
    "subtitle": null,
    "iconUrl": "/sdk/icons/slack.svg",
    "linkType": "Slack",
    "requiresConnection": true
  }
}
```

---

### 6. Security Constraints

- Tokens encrypted with AES-256-GCM before write, decrypted only within the provider module at resolution time.
- SSRF guard applied to every outbound URL in resolve and open-graph fallback paths.
- OAuth `state` CSRF tokens are single-use and expire after 10 minutes.
- The resolution endpoint rate-limits to 60 requests/minute per authenticated user (reuse existing `RATE_LIMIT_ENABLED` middleware).
- `GET /callback/:provider` accepts only authenticated requests — the user must be logged in before initiating OAuth.
- Tokens are refreshed automatically before each resolution call when `token_expires_at` is within 60 seconds.

---

## Acceptance Criteria

- [ ] `user_connected_accounts`, `smart_link_cache` tables created and migrated (`0118`)
- [ ] `smart_links_opt_in` column added to `users` table (`0119`), defaults to `true`
- [ ] `GET /providers` returns all 8 providers with correct `connected` + `configured` fields and `metadata.userOptIn`
- [ ] `GET /preference` returns `{ optIn: true }` for a new user
- [ ] `PATCH /preference` with `{ optIn: false }` persists the value and returns `{ optIn: false }`
- [ ] `POST /resolve` returns `{ data: null }` immediately when the user's `smart_links_opt_in` is `false` (no cache read, no upstream call)
- [ ] OAuth flow completes end-to-end for at least `google` and `github` providers
- [ ] `POST /resolve` returns `requiresConnection: false` with title/subtitle when user is connected
- [ ] `POST /resolve` returns `requiresConnection: true` with `title: null` when user is not connected
- [ ] `POST /resolve` returns open-graph fallback title for unrecognised URLs
- [ ] Cache hit path verified: second call for same URL within TTL does not make upstream request
- [ ] SSRF guard blocks resolution of private-range URLs
- [ ] `SMART_LINKS_ENABLED=false` causes all routes to return `501`
- [ ] Tokens at rest are AES-256-GCM encrypted; no plaintext in DB dump
- [ ] `DELETE /connect/:provider` removes the connected account row
