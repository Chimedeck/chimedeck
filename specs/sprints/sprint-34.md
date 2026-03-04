# Sprint 34 — Plugin System: Server, SDK & Database

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 05 (Board Lifecycle), Sprint 03 (Authentication)
> **Architecture reference:** [`specs/architecture/plugins.md`](../architecture/plugins.md)

---

## Goal

Establish the full server-side foundation for the plugin system: database schema, REST API for board plugin management and plugin data storage, a platform-issued SDK served at `/sdk/jh-instance.js`, and an internal plugin registry API. At the end of this sprint, a plugin `connector.html` can be loaded in an iframe, call `jhInstance.initialize(...)`, and interact with board/card data through the SDK — no dashboard UI yet.

---

## Scope

### 1. Database Migrations

**File:** `db/migrations/0021_plugins.ts`

Four tables in a single migration:

```sql
-- Plugin registry (marketplace catalogue)
CREATE TABLE plugins (
  id            TEXT PRIMARY KEY,           -- CUID2
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  description   TEXT,
  icon_url      TEXT,
  connector_url TEXT NOT NULL,
  manifest_url  TEXT,
  author        TEXT,
  author_email  TEXT,
  support_email TEXT,
  categories    TEXT[]  DEFAULT '{}',
  capabilities  JSONB   DEFAULT '{}',
  is_public     BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  api_key       TEXT    NOT NULL,            -- platform-issued, scopes all plugin data calls
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Which plugins are enabled on which boards
CREATE TABLE board_plugins (
  id          TEXT PRIMARY KEY,
  board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  plugin_id   TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  enabled_by  TEXT NOT NULL REFERENCES users(id),
  enabled_at  TIMESTAMPTZ DEFAULT NOW(),
  disabled_at TIMESTAMPTZ DEFAULT NULL,      -- NULL = currently active
  config      JSONB DEFAULT '{}',
  UNIQUE (board_id, plugin_id)
);

-- Plugin-scoped key/value storage (t.get / t.set)
CREATE TABLE plugin_data (
  id          TEXT PRIMARY KEY,
  plugin_id   TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  scope       TEXT NOT NULL CHECK (scope IN ('card','list','board','member')),
  resource_id TEXT NOT NULL,
  user_id     TEXT REFERENCES users(id),     -- NULL = shared; set = private
  key         TEXT NOT NULL,
  value       JSONB,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plugin_id, scope, resource_id, user_id, key)
);

-- Reserved for future plugin OAuth / API key flows; not yet implemented
CREATE TABLE plugin_auth_tokens (
  id              TEXT PRIMARY KEY,
  board_plugin_id TEXT NOT NULL REFERENCES board_plugins(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL,             -- encrypted at rest
  token_type      TEXT NOT NULL CHECK (token_type IN ('oauth2','api_key','jwt')),
  expires_at      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2. Server Extension Structure

**Root:** `server/extensions/plugins/`

```
server/extensions/plugins/
├── api/
│   ├── index.ts                    ← mounts all plugin routes under /api/v1
│   ├── board-plugins/
│   │   ├── list.ts                 ← GET  /api/v1/boards/:boardId/plugins
│   │   ├── enable.ts               ← POST /api/v1/boards/:boardId/plugins
│   │   └── disable.ts              ← DELETE /api/v1/boards/:boardId/plugins/:pluginId
│   ├── plugin-data/
│   │   ├── get.ts                  ← GET  /api/v1/plugins/data
│   │   └── set.ts                  ← PUT  /api/v1/plugins/data
│   └── registry/
│       ├── list.ts                 ← GET  /api/v1/plugins
│       ├── get.ts                  ← GET  /api/v1/plugins/:pluginId
│       ├── create.ts               ← POST /api/v1/plugins
│       ├── update.ts               ← PATCH /api/v1/plugins/:pluginId
│       └── delete.ts               ← DELETE /api/v1/plugins/:pluginId
├── sdk/
│   └── jh-instance.ts              ← SDK source; built to public/sdk/jh-instance.js
├── middlewares/
│   └── board-admin-guard.ts        ← verifies caller is a board admin
└── config/
    └── index.ts                    ← API_BASE_URL, SDK_ORIGIN, etc.
```

---

### 3. Board Plugin Management API

#### `GET /api/v1/boards/:boardId/plugins`

Returns all currently **active** (non-disabled) plugins on the board, with plugin metadata included.

**Auth:** Any board member.

```ts
// Response
{
  data: Array<{
    id: string;           // board_plugins.id
    boardId: string;
    pluginId: string;
    enabledAt: string;
    config: object;
    plugin: {
      id: string;
      name: string;
      slug: string;
      description: string;
      iconUrl: string;
      connectorUrl: string;
      capabilities: object;
      categories: string[];
    };
  }>;
}
```

#### `POST /api/v1/boards/:boardId/plugins`

Enable a plugin on the board. **Board admin only.**

```ts
// Request body
{ pluginId: string }

// Response — the newly created board_plugins row + plugin metadata
{ data: BoardPluginWithPlugin }
```

Error if the plugin is already active on the board: `{ name: 'plugin-already-enabled' }`.
Error if the plugin is not active in the registry: `{ name: 'plugin-not-active' }`.

#### `DELETE /api/v1/boards/:boardId/plugins/:pluginId`

Soft-disable: sets `board_plugins.disabled_at = NOW()`. **Board admin only.**

```ts
// Response
{ data: {} }
```

Error if no active record found: `{ name: 'plugin-not-found-on-board' }`.

---

### 4. Plugin Data Storage API

Called **by plugins** over `fetch`, authenticated by the plugin's `api_key` in the `Authorization: ApiKey <key>` header. The server scopes all reads/writes to the calling plugin only — a plugin cannot touch another plugin's data.

#### `GET /api/v1/plugins/data`

Query params: `scope`, `resourceId`, `key`, `visibility` (`shared` | `private`).

For `private` visibility, the server injects the authenticated user's id as `user_id` automatically — the plugin cannot request another user's private data.

```ts
// Response
{ data: { value: any } }
```

#### `PUT /api/v1/plugins/data`

```ts
// Request body
{
  scope: 'card' | 'list' | 'board' | 'member';
  resourceId: string;
  key: string;
  visibility: 'shared' | 'private';
  value: any;
}

// Response — the persisted row
{ data: { scope, resourceId, key, visibility, value, updatedAt } }
```

---

### 5. Plugin Registry API (Internal / Admin)

These endpoints are platform-admin only (gated by a `platform-admin` role check, not exposed to regular users or board admins).

| Method | Path | Action |
|---|---|---|
| `GET` | `/api/v1/plugins` | List all plugins. Non-admin callers only see `is_public = true && is_active = true`. |
| `GET` | `/api/v1/plugins/:pluginId` | Plugin detail + cached capabilities. |
| `POST` | `/api/v1/plugins` | Register a new plugin. Server generates `api_key` (CUID2) and stores in DB. |
| `PATCH` | `/api/v1/plugins/:pluginId` | Update name, description, icon, connector_url, capabilities etc. |
| `DELETE` | `/api/v1/plugins/:pluginId` | Sets `is_active = false` (soft delete). |

Registration flow:
1. Admin POSTs `{ name, slug, connectorUrl, manifestUrl, ... }`.
2. Server fetches `manifestUrl`, validates the JSON, caches `capabilities`.
3. Server generates an `api_key` and returns it **once** — it is not retrievable again.

---

### 6. Board Admin Guard Middleware

**File:** `server/extensions/plugins/middlewares/board-admin-guard.ts`

Reusable middleware that reads `:boardId` from `req.params`, looks up `board_members` for the authenticated user, and rejects with `{ name: 'not-board-admin' }` + HTTP 403 if they are not an admin or workspace admin.

```ts
// Usage in route mount
router.post('/:boardId/plugins', boardAdminGuard, enable);
router.delete('/:boardId/plugins/:pluginId', boardAdminGuard, disable);
```

---

### 7. `jhInstance` SDK

**Source:** `server/extensions/plugins/sdk/jh-instance.ts`
**Served at:** `GET /sdk/jh-instance.js` (static file, built via `bun build`)

The SDK is the bridge between the plugin iframe and the host board page. It exposes a `window.jhInstance` global that is **API-compatible with the Trello `TrelloPowerUp` object**, so an existing `client.js` using `TrelloPowerUp.initialize(...)` can be made compatible by adding:

```js
window.TrelloPowerUp = window.jhInstance;
```

#### SDK responsibilities

1. **`jhInstance.initialize(capabilities, config)`** — called once in `connector.html`. Registers capability handlers, sends a `PLUGIN_READY` message to the host via `postMessage`, and begins listening for `RESOLVE_CAPABILITY` requests from the host.

2. **`jhInstance.iframe()`** — used in non-connector pages (modals, settings pages). Returns a `FrameContext` (`t`) hydrated from the `args` query param passed by the host when it opens the iframe.

3. **`FrameContext` (`t`) methods** — thin wrappers that either:
   - Call our REST API directly (for `t.get`, `t.set`, `t.card`, `t.list`, `t.board`, `t.member`), or
   - Send a `postMessage` to the host (for UI actions: `t.popup`, `t.modal`, `t.closeModal`, `t.sizeTo`, `t.updateModal`).

#### `postMessage` protocol (internal, between SDK and host)

All messages follow the shape:

```ts
interface SdkMessage {
  source: 'jh-plugin';
  pluginId: string;
  type: string;      // e.g. 'PLUGIN_READY' | 'RESOLVE_CAPABILITY_RESPONSE' | 'UI_POPUP' | 'UI_MODAL' | ...
  payload: any;
}
```

| Message type | Direction | Meaning |
|---|---|---|
| `PLUGIN_READY` | iframe → host | Capabilities have been registered; plugin is ready |
| `RESOLVE_CAPABILITY` | host → iframe | Host asks plugin to invoke a capability handler |
| `RESOLVE_CAPABILITY_RESPONSE` | iframe → host | Plugin returns capability result |
| `UI_POPUP` | iframe → host | Plugin calls `t.popup(...)` |
| `UI_MODAL` | iframe → host | Plugin calls `t.modal(...)` |
| `UI_CLOSE_MODAL` | iframe → host | Plugin calls `t.closeModal()` |
| `UI_UPDATE_MODAL` | iframe → host | Plugin calls `t.updateModal(...)` |
| `UI_SIZE_TO` | iframe → host | Plugin calls `t.sizeTo(...)` |

The host validates `event.origin` on every incoming message against the plugin's registered `connector_url` origin (stored in `board_plugins → plugins.connector_url`).

#### SDK data access

`t.card(...)`, `t.list(...)`, `t.board(...)`, `t.member(...)` are backed by direct `fetch` calls to the platform REST API. The SDK includes the `api_key` (from `jhInstance.initialize` config) and the current board/card context (injected by the host as iframe `src` query params) in each request.

`t.get` / `t.set` call `GET /api/v1/plugins/data` and `PUT /api/v1/plugins/data` respectively.

#### `t.getRestApi()`

Returns a stub `RestApiClient`. In this sprint, `isAuthorized()` always returns `true` (all plugins call our API with `api_key` only). The interface matches the full OAuth shape defined in the architecture doc so future auth can be dropped in without changing call sites.

#### Build

```bash
bun build server/extensions/plugins/sdk/jh-instance.ts \
  --outfile public/sdk/jh-instance.js \
  --minify \
  --target browser
```

The built file is committed and served statically. The build runs as part of `bun run build`.

---

### 8. SDK Static Route

**File:** `server/index.ts` (or the existing static middleware)

```ts
// Serve the SDK bundle
app.use('/sdk', serveStatic('public/sdk'));
```

With `Content-Type: application/javascript` and a long `Cache-Control` (versioned by build hash).

---

## File Summary

| File | New / Modified |
|---|---|
| `db/migrations/0021_plugins.ts` | New |
| `server/extensions/plugins/config/index.ts` | New |
| `server/extensions/plugins/middlewares/board-admin-guard.ts` | New |
| `server/extensions/plugins/api/index.ts` | New |
| `server/extensions/plugins/api/board-plugins/list.ts` | New |
| `server/extensions/plugins/api/board-plugins/enable.ts` | New |
| `server/extensions/plugins/api/board-plugins/disable.ts` | New |
| `server/extensions/plugins/api/plugin-data/get.ts` | New |
| `server/extensions/plugins/api/plugin-data/set.ts` | New |
| `server/extensions/plugins/api/registry/list.ts` | New |
| `server/extensions/plugins/api/registry/get.ts` | New |
| `server/extensions/plugins/api/registry/create.ts` | New |
| `server/extensions/plugins/api/registry/update.ts` | New |
| `server/extensions/plugins/api/registry/delete.ts` | New |
| `server/extensions/plugins/sdk/jh-instance.ts` | New |
| `public/sdk/jh-instance.js` | Generated (bun build) |
| `server/index.ts` | Modified — mount plugins routes + SDK static |

---

## Acceptance Criteria

- [ ] Migration runs cleanly (`bun run migrate`); all four tables exist with correct constraints.
- [ ] `POST /api/v1/boards/:boardId/plugins` returns 403 for non-admins.
- [ ] `POST /api/v1/boards/:boardId/plugins` creates a `board_plugins` row and returns the plugin.
- [ ] `DELETE /api/v1/boards/:boardId/plugins/:pluginId` soft-disables (sets `disabled_at`); row persists.
- [ ] `GET /api/v1/boards/:boardId/plugins` returns only active plugins (disabled ones excluded).
- [ ] `PUT /api/v1/plugins/data` persists a value; `GET /api/v1/plugins/data` returns it.
- [ ] `private` data for user A is not returned when user B requests the same key.
- [ ] `GET /sdk/jh-instance.js` returns a JavaScript bundle with `Content-Type: application/javascript`.
- [ ] `window.jhInstance` is defined after loading the SDK in a plain HTML page.
- [ ] `jhInstance.initialize(capabilities, config)` registers handlers without throwing.
- [ ] `TrelloPowerUp.initialize(...)` works when the compatibility shim `window.TrelloPowerUp = window.jhInstance` is added — matching the `client.js` pattern from `sample-project/trello-sample/web/server/js/client.js`.
- [ ] Integration test: enable a plugin, call `t.set('card','shared','foo','bar')`, call `t.get(...)`, receive `'bar'`.
