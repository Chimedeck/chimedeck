# Architecture — Plugin System

---

## 1. Concept Overview

Plugins are first-party extensions created by us that add capabilities to boards. Each plugin:

1. Registers itself in the **Plugin Registry** with metadata and a **connector URL**.
2. When enabled on a board, the platform loads the connector URL into a hidden `<iframe>`.
3. The iframe runs `connector.html`, which loads the **`jhInstance` SDK** and the plugin's `client.js`.
4. `client.js` calls `jhInstance.initialize(capabilities, config)` to register handlers.
5. The SDK brokers communication between the plugin iframe and the host board UI via `postMessage`.

---

## 2. Plugin Data Model

### `plugins` table
Stores the registry of all available plugins (the "marketplace catalogue").

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | CUID2 |
| `name` | `text` | Display name (e.g. "Escrow Pay") |
| `slug` | `text` UNIQUE | URL-safe identifier (e.g. `escrow-pay`) |
| `description` | `text` | Short description shown in marketplace |
| `icon_url` | `text` | Icon image URL |
| `connector_url` | `text` | URL of the `connector.html` entry point |
| `manifest_url` | `text` | URL of the `manifest.json` describing capabilities |
| `author` | `text` | Display author name |
| `author_email` | `text` | Contact email |
| `support_email` | `text` | Support contact |
| `categories` | `text[]` | For marketplace search/filter (e.g. `["payments","finance"]`) |
| `capabilities` | `jsonb` | Mirror of `manifest.json#capabilities` — cached on registration |
| `is_public` | `boolean` DEFAULT `false` | Whether visible in the marketplace |
| `is_active` | `boolean` DEFAULT `true` | Whether the plugin can be installed |
| `api_key` | `text` | A platform-issued key the plugin uses to call our API |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

> **Why `capabilities` in DB?** Allows the board UI to know what UI injection points to prepare (button slots, badge areas, etc.) without fetching the manifest at runtime.

### `board_plugins` table
Tracks which plugins are enabled on which boards.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | CUID2 |
| `board_id` | `text` FK → `boards.id` | |
| `plugin_id` | `text` FK → `plugins.id` | |
| `enabled_by` | `text` FK → `users.id` | Board admin who enabled it |
| `enabled_at` | `timestamptz` | |
| `disabled_at` | `timestamptz` NULLABLE | NULL = currently active |
| `config` | `jsonb` DEFAULT `{}` | Per-board plugin configuration (reserved for future) |

Unique constraint on `(board_id, plugin_id)`.

### `plugin_auth_tokens` table *(reserved — not implemented yet)*
Provides room for per-user plugin authentication tokens in future (OAuth / API key flows).

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | CUID2 |
| `board_plugin_id` | `text` FK → `board_plugins.id` | |
| `user_id` | `text` FK → `users.id` | |
| `token` | `text` | Encrypted credential |
| `token_type` | `text` | `oauth2` \| `api_key` \| `jwt` |
| `expires_at` | `timestamptz` NULLABLE | |
| `created_at` | `timestamptz` | |

---

## 3. Plugin Manifest (`manifest.json`)

Each plugin ships a `manifest.json` at its root. The platform fetches this on registration and caches the `capabilities` field in the `plugins` table.

```json
{
  "name": "Plugin Display Name",
  "key": "<api_key issued by platform>",
  "description": "Short description",
  "iconUrl": "https://example.com/icon.png",
  "url": "https://example.com/connector.html",
  "capabilities": {
    "card-buttons": {
      "name": "Card Buttons",
      "description": "Adds custom action buttons to card front"
    },
    "card-badges": {
      "name": "Card Badges",
      "description": "Shows compact badges on card front"
    },
    "card-detail-badges": {
      "name": "Card Detail Badges",
      "description": "Shows detailed badges on card back"
    },
    "show-settings": {
      "name": "Settings",
      "description": "Renders a settings modal for board-level config"
    },
    "authorization-status": {
      "name": "Authorization Status",
      "description": "Reports whether the current user has authorized the plugin"
    },
    "show-authorization": {
      "name": "Authorization",
      "description": "Renders the plugin's authorization flow"
    },
    "section": {
      "name": "Card Section",
      "description": "Renders an additional section on the card back"
    }
  }
}
```

### Capability contract

| Capability | When invoked | Expected return |
|---|---|---|
| `card-buttons` | Card front rendered | `Array<{ icon, text, callback }>` |
| `card-badges` | Card front rendered | `Array<{ title, text, icon, color }>` |
| `card-detail-badges` | Card back opened | `Array<{ title, text, icon, color }>` |
| `show-settings` | Board settings clicked | Opens a URL in a modal |
| `authorization-status` | On frame init | `{ authorized: boolean }` |
| `show-authorization` | User triggers auth | Opens authorization iframe/modal |
| `section` | Card back opened | `{ title, url }` |

---

## 4. The `connector.html` Entry Point

Each plugin hosts a `connector.html` that is loaded into a hidden iframe on the board page when the plugin is active. This is the plugin's runtime entry.

```html
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body>
    <!-- jhInstance SDK served by our platform -->
    <script src="https://<our-domain>/sdk/jh-instance.js"></script>
    <!-- Plugin-specific logic -->
    <script src="/client.js"></script>
  </body>
</html>
```

The iframe is hidden (`display: none`) and lives at a stable origin. The SDK communicates with the host board UI over `postMessage`.

### Pages a plugin can expose

A plugin may ship additional HTML pages that are loaded by the SDK into popups or modals:

| File | Purpose |
|---|---|
| `connector.html` | **Required.** Hidden iframe. Registers all capabilities via `jhInstance.initialize`. |
| `settings.html` | Board-level settings UI (loaded by `show-settings` capability). |
| `modal.html` | Generic fullscreen modal for complex flows. |
| `section.html` | Custom section rendered on card back (loaded by `section` capability). |
| `dispute.html` | Example plugin-specific page for dispute flow. |
| `api-client-authorize.html` | OAuth / authorization handshake page. |
| `payment-success.html` | Post-payment confirmation page. |

---

## 5. The `jhInstance` SDK

The platform serves a JavaScript SDK at `/sdk/jh-instance.js`. It wraps the cross-iframe `postMessage` protocol and exposes a Trello-Power-Up-compatible API surface to plugin developers.

### Global

```js
// Available globally after the script is loaded
window.jhInstance
```

### Primary API

```ts
jhInstance.initialize(
  capabilities: Record<string, CapabilityHandler>,
  config: { appKey: string; appName: string }
): void
```

Registers all capability handlers. Called once in `connector.html`.

```ts
jhInstance.iframe(): FrameContext
```

Used in non-connector pages (modals, sections) to get the `t` context passed to them.

### `FrameContext` (`t`) methods

```ts
// Read plugin-scoped data stored on a resource
t.get(scope: 'card' | 'list' | 'board' | 'member', visibility: 'private' | 'shared', key: string): Promise<any>

// Write plugin-scoped data
t.set(scope: 'card' | 'list' | 'board' | 'member', visibility: 'private' | 'shared', key: string, value: any): Promise<void>

// Read data about the current context
t.card(...fields: string[]): Promise<CardData>
t.list(...fields: string[]): Promise<ListData>
t.board(...fields: string[]): Promise<BoardData>
t.member(...fields: string[]): Promise<MemberData>

// UI actions
t.popup(options: { title, url, args?, mouseEvent? }): void
t.modal(options: { title, url, fullscreen?, accentColor? }): void
t.updateModal(options: Partial<{ title, fullscreen, accentColor }>): void
t.closePopup(): void
t.closeModal(): void
t.sizeTo(element: HTMLElement | string): void

// Read iframe args passed by the host
t.arg(key: string): any

// Lifecycle / rendering
t.render(fn: () => void): void

// API access (for authorized plugins)
t.getRestApi(): RestApiClient

// Plugin-specific args
t.args: Record<string, any>
```

### `RestApiClient`

```ts
interface RestApiClient {
  isAuthorized(): Promise<boolean>;
  authorize(options?: { scope?: string }): Promise<void>;
  getToken(): Promise<string | null>;
  request(path: string, options?: RequestInit): Promise<Response>;
}
```

### Plugin-scoped storage

`t.get` / `t.set` persist data per `(plugin_id, scope, resource_id, visibility, key)` in the `plugin_data` table. `private` data is only readable by the user who wrote it; `shared` data is visible to all board members.

```
plugin_data
  plugin_id     → plugins.id
  scope         → 'card' | 'list' | 'board' | 'member'
  resource_id   → id of the scoped resource
  user_id       → null for 'shared', user id for 'private'
  key           → string
  value         → jsonb
```

### SDK Compatibility Note

The `jhInstance` API is intentionally compatible with the Trello Power-Up `TrelloPowerUp` API shape. Existing Power-Up `client.js` files can be made compatible by aliasing:

```js
// Compatibility shim
window.TrelloPowerUp = window.jhInstance;
```

---

## 6. Plugin Admin Dashboard

> Accessible at `/admin/plugins` — **board admin only** (same permission model as board settings).

The dashboard lets board admins:

1. **Browse available plugins** — list of all `plugins` where `is_active = true`.
2. **Enable a plugin on the current board** — creates a `board_plugins` record.
3. **Disable an active plugin** — sets `board_plugins.disabled_at`.
4. **View plugin details** — name, description, icon, author, capabilities, categories.

### Sections (mirroring the Atlassian App Admin Portal)

| Section | Purpose |
|---|---|
| **Basic Information** | Name, description, icon, author, connector URL, categories |
| **Capabilities** | Toggle list of what the plugin can do on this board |
| **Distribution** | (reserved) How to share / embed the plugin button |
| **Privacy & Compliance** | Whether the plugin stores personal data, GDPR notes |

### Plugin marketplace (for future)

The `is_public` flag on `plugins` gates which plugins appear in a future public marketplace. The data schema already supports:

- Categories for search/filter
- Listings metadata (name, description, icon, author)
- Capabilities for discovery
- `is_public` / `is_active` flags for visibility and availability

No marketplace UI is built in this iteration — the data layer is ready.

---

## 7. Permissions

| Action | Required Role |
|---|---|
| View enabled plugins on a board | Any board member |
| Enable / disable a plugin on a board | Board admin or workspace admin |
| Create / update plugin in registry | Platform admin (server-side only, no UI yet) |
| Delete plugin from registry | Platform admin |
| Read `shared` plugin data | Any board member |
| Read `private` plugin data | The member who wrote it |

---

## 8. API Endpoints

### Board plugin management

```
GET    /api/boards/:boardId/plugins           → list enabled plugins for a board
POST   /api/boards/:boardId/plugins           → enable a plugin (body: { pluginId })
DELETE /api/boards/:boardId/plugins/:pluginId → disable a plugin
```

### Plugin data storage (called by plugin via SDK)

```
GET    /api/plugins/data?scope=card&resourceId=:id&key=:key&visibility=shared
PUT    /api/plugins/data                       → { scope, resourceId, key, visibility, value }
```

### Plugin registry (internal / admin)

```
GET    /api/plugins             → list all plugins (admin: all; others: active public only)
GET    /api/plugins/:pluginId   → plugin detail + manifest
POST   /api/plugins             → register a new plugin
PATCH  /api/plugins/:pluginId   → update plugin info
DELETE /api/plugins/:pluginId   → deactivate plugin
```

### SDK delivery

```
GET    /sdk/jh-instance.js      → serves the jhInstance SDK bundle
```

---

## 9. Runtime Flow

```
Board page load
  └── fetch board_plugins WHERE board_id = X AND disabled_at IS NULL
      └── for each enabled plugin:
            └── inject <iframe src="{connector_url}" style="display:none">

iframe loads connector.html
  └── <script src="/sdk/jh-instance.js">      ← our SDK
  └── <script src="/client.js">               ← plugin code
      └── jhInstance.initialize({
            'card-badges': (t) => [...],
            'card-buttons': (t) => [...],
            ...
          }, { appKey, appName })
          └── SDK registers handlers, signals READY to host via postMessage

Host board UI
  └── on 'card-front:render':
        └── broadcast to all plugin iframes "resolve:card-badges" with card context
        └── collect badge responses → render on card
  └── on 'card-back:open':
        └── broadcast "resolve:card-detail-badges", "resolve:section"
  └── on user action (button click):
        └── invoke registered callback in plugin iframe (t.popup / t.modal)
```

---

## 10. Server: Serving the SDK

The existing Express/Bun server gains a new route to serve the SDK JavaScript bundle.

**Location:** `server/extensions/plugins/sdk/`

```
server/extensions/plugins/
  ├── api/
  │   ├── index.ts            ← mounts all plugin routes
  │   ├── board-plugins/
  │   │   ├── list.ts
  │   │   ├── enable.ts
  │   │   └── disable.ts
  │   ├── plugin-data/
  │   │   ├── get.ts
  │   │   └── set.ts
  │   └── registry/
  │       ├── list.ts
  │       ├── get.ts
  │       ├── create.ts
  │       ├── update.ts
  │       └── delete.ts
  ├── sdk/
  │   └── jh-instance.ts      ← SDK source, built to jh-instance.js
  ├── middlewares/
  │   └── board-admin-guard.ts ← ensures caller is board admin
  └── config/
      └── index.ts             ← plugin system config (API_BASE_URL, etc.)
```

The SDK is built with `bun build` and output to `public/sdk/jh-instance.js` which is served as a static file.

---

## 11. Security

- **Deny first:** Plugins are disabled by default. A board admin must explicitly enable each one.
- **Board admin gate:** All enable/disable actions verify that the requesting user is a board admin.
- **`api_key` scoping:** When a plugin calls `/api/plugins/data`, the request must include the `api_key` from its `manifest.json`. This key scopes all data reads/writes to that plugin only.
- **Plugin origin isolation:** Because each plugin runs in its own iframe, it cannot access the DOM or memory of the host board page. `postMessage` is the only communication channel, and the SDK validates the `event.origin` against the registered `connector_url`.
- **Authentication (reserved):** The `plugin_auth_tokens` table and `t.getRestApi()` interface are reserved for future OAuth/JWT flows. Currently, plugins call our API with the `api_key` only.
- **`private` visibility:** Plugin data stored with `visibility: 'private'` is gated by `user_id` on the server — the plugin cannot access another user's private data even if it crafts a direct API call.
