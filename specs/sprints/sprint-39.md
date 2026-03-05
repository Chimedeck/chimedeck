# Sprint 39 — Plugin Domain Whitelisting & Edit Plugin UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 36 (Plugin Registry CRUD), Sprint 38 (Plugin Data Board Isolation)
> **Architecture reference:** [`specs/architecture/plugins.md`](../architecture/plugins.md)

---

## Goal

Two tightly coupled improvements to the plugin system:

1. **Plugin domain declaration** — Plugins can declare the set of external domains they need to communicate with (e.g. payment gateways, their own API servers). This is stored in a new `whitelisted_domains` column on the `plugins` table.
2. **Board-level domain allowlist** — When a plugin is enabled on a board, the board admin can restrict which of the plugin's declared domains are actually permitted for that board. The selected subset is stored in `board_plugins.config.allowedDomains`. The host iframe bridge enforces this list at runtime.
3. **Edit Plugin UI** — A platform admin can edit an existing plugin's metadata and domain list after initial registration without raw SQL.

When this sprint is done:
- A plugin author declares `whitelistedDomains: ["https://api.stripe.com", "https://myservice.com"]` on registration.
- A board admin who enables the plugin sees the declared domains and can deselect any they do not want active on their board.
- The iframe host bridge checks `allowedDomains` before forwarding outbound messages or popups to those origins.
- A platform admin can open the "Edit Plugin" form at any time to update metadata or add/remove declared domains.

---

## Scope

---

### 1. DB Migration — add `whitelisted_domains` to `plugins`

**File:** `db/migrations/0023_plugin_whitelisted_domains.ts`

```typescript
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plugins', (table) => {
    // [why] Stores the list of external origins the plugin is permitted to
    // communicate with. Board admins select a subset from this list.
    // Nullable: NULL means "no domains declared" (legacy plugins remain unrestricted).
    table.specificType('whitelisted_domains', 'text[]').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plugins', (table) => {
    table.dropColumn('whitelisted_domains');
  });
}
```

> **`board_plugins.config`** already exists as `jsonb DEFAULT '{}'`. No migration needed — the new `allowedDomains` field is stored inside it.

---

### 2. Server — Plugin Registry: accept `whitelistedDomains`

#### `POST /api/v1/plugins` — updated body

```ts
{
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  connectorUrl: string;
  manifestUrl?: string;
  author?: string;
  authorEmail?: string;
  supportEmail?: string;
  categories?: string[];
  capabilities?: Record<string, { name: string; description: string }>;
  isPublic?: boolean;
  whitelistedDomains?: string[];   // ← new: list of HTTPS origins this plugin may contact
}
```

**Validation rules for `whitelistedDomains`:**
- Each entry must be a valid HTTPS origin (scheme + host, no path): `https://api.example.com`.
- Reject entries that use `http://` or contain path segments beyond the origin.
- Max 20 entries per plugin.
- Duplicates are deduplicated silently before persistence.

**Error additions:**

| Name | Status | When |
|------|--------|------|
| `invalid-whitelisted-domain` | 422 | One or more domains are not valid HTTPS origins |
| `too-many-whitelisted-domains` | 422 | More than 20 entries supplied |

**File:** `server/extensions/plugins/api/register.ts`

```typescript
// After existing validation, add:

if (whitelistedDomains) {
  if (whitelistedDomains.length > 20) {
    return Response.json(
      { name: 'too-many-whitelisted-domains', data: { message: 'Maximum 20 domains allowed' } },
      { status: 422 },
    );
  }

  const invalid = whitelistedDomains.filter((d) => !isValidHttpsOrigin(d));
  if (invalid.length > 0) {
    return Response.json(
      { name: 'invalid-whitelisted-domain', data: { domains: invalid } },
      { status: 422 },
    );
  }
}
```

**Helper:**

```typescript
// server/extensions/plugins/common/isValidHttpsOrigin.ts
export function isValidHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.pathname === '/' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}
```

#### `PATCH /api/v1/plugins/:pluginId` — updated body

Same as POST but all fields optional. When `whitelistedDomains` is included it **replaces** the current list. Pass `whitelistedDomains: []` to clear.

**File:** `server/extensions/plugins/api/update.ts`

When updating, re-validate domains using the same `isValidHttpsOrigin` helper.

---

### 3. Server — Board Plugin Allowed Domains

#### `GET /api/v1/boards/:boardId/plugins/:pluginId`

Returns the current `board_plugins` row, including `config` (which now surfaces `allowedDomains`). This endpoint already exists (sprint 34) — no change to route, but the response schema is extended:

```ts
{
  data: {
    id: string;
    boardId: string;
    pluginId: string;
    enabledAt: string;
    config: {
      allowedDomains: string[] | null;  // ← surfaced; null = "inherit all from plugin"
    };
  };
  includes: {
    plugins: Plugin; // includes the plugin's whitelistedDomains via the join
  };
}
```

#### `PATCH /api/v1/boards/:boardId/plugins/:pluginId/allowed-domains`

Updates the per-board allowed domain subset.

- **Auth:** Board admin (`boardAdminGuard`).
- **Body:**

```ts
{
  allowedDomains: string[] | null;
  // null  → inherit all domains declared by the plugin (default)
  // []    → no domains permitted for this board
  // [...] → explicit subset; must be a strict subset of the plugin's whitelistedDomains
}
```

- **Success:** `200` `{ data: { boardId, pluginId, config: { allowedDomains } } }`
- **Errors:**

| Name | Status | When |
|------|--------|------|
| `board-plugin-not-found` | 404 | The plugin is not enabled on this board |
| `domain-not-whitelisted-by-plugin` | 422 | An entry in `allowedDomains` is not in the plugin's `whitelistedDomains` |

**File:** `server/extensions/plugins/api/board-allowed-domains.ts`

```typescript
// Validation: every domain in the board list must exist in the plugin's whitelistedDomains
const pluginDomains: string[] = plugin.whitelisted_domains ?? [];

if (allowedDomains !== null) {
  const unknown = allowedDomains.filter((d) => !pluginDomains.includes(d));
  if (unknown.length > 0) {
    return Response.json(
      { name: 'domain-not-whitelisted-by-plugin', data: { domains: unknown } },
      { status: 422 },
    );
  }
}

// Persist into board_plugins.config patch:
await db('board_plugins')
  .where({ board_id: boardId, plugin_id: pluginId })
  .update({
    config: db.raw(`config || ?::jsonb`, [JSON.stringify({ allowedDomains })]),
    // [why] JSON merge so other config keys (future) are preserved
  });
```

---

### 4. Runtime enforcement — iframe host bridge

**File:** `src/extensions/Plugins/iframeHost/usePluginBridge.ts`

When the bridge initialises a plugin iframe, compute the effective allowed origins:

```typescript
// [why] null = allow all plugin-declared domains; [] = block all;
// explicit array = subset
const effectiveDomains: string[] =
  boardPlugin.config?.allowedDomains === null || boardPlugin.config?.allowedDomains === undefined
    ? (plugin.whitelistedDomains ?? [])
    : boardPlugin.config.allowedDomains;
```

Use `effectiveDomains` to:

1. **`postMessage` validation** — when receiving a message from the plugin iframe, verify `event.origin` is in `effectiveDomains` (in addition to the existing connector URL check). Log and discard messages from unlisted origins.
2. **Popup / modal URL validation** — when the plugin requests `t.popup({ url })` or  `t.modal({ url })`, verify the URL's origin is in `effectiveDomains`. Reject with an error response if not.

```typescript
case 'OPEN_POPUP':
case 'OPEN_MODAL': {
  const origin = new URL(data.payload.url).origin;
  if (effectiveDomains.length > 0 && !effectiveDomains.includes(origin)) {
    sendToPlugin(bp.plugin.id, {
      jhSdk: true,
      id: data.id,
      error: { name: 'domain-not-allowed', data: { origin } },
    });
    return;
  }
  // ... existing popup/modal handling
}
```

---

### 5. Client — Edit Plugin Modal (platform admin)

Platform admins can edit an existing plugin after creation. The edit modal reuses the same field structure as `RegisterPluginModal.tsx` (sprint 36) but pre-populates fields from the current plugin record.

**File:** `src/extensions/Plugins/modals/EditPluginModal.tsx`

Fields (all editable):
- `name`
- `description`
- `iconUrl`
- `connectorUrl`
- `manifestUrl`
- `author` / `authorEmail` / `supportEmail`
- `categories` (tag input, same as register form)
- `whitelistedDomains` (tag input — one HTTPS origin per tag, validated on blur)
- `isPublic` (toggle)
- `isActive` (toggle — allows re-activating a soft-deleted plugin)

> **`api_key` is never shown** in the edit form — it was revealed once on registration.

**Trigger:** An "Edit" (pencil icon) button on each plugin card in the Admin Plugin list (visible to platform admins only). Clicking opens the modal pre-filled.

**On submit:** `PATCH /api/v1/plugins/:pluginId`. Success updates the plugin in the Redux store and closes the modal with a toast "Plugin updated."

**Duck updates:** `PluginDashboardPage.duck.ts`

```ts
// New thunk:
export const updatePluginThunk = createAsyncThunk(
  'plugins/update',
  async ({ pluginId, payload }: { pluginId: string; payload: UpdatePluginPayload }) => {
    const res = await api.patch(`/api/v1/plugins/${pluginId}`, payload);
    return res.data.data as Plugin;
  },
);
```

---

### 6. Client — Board Domain Allowlist Panel

When a board admin views an enabled plugin in the Plugin Dashboard, a new **"Allowed Domains"** section appears below the plugin's details if the plugin has declared any `whitelistedDomains`.

**Location:** Inside `PluginModal.tsx` (the per-plugin detail/settings modal).

```
┌─────────────────────────────────────────────────────┐
│  Escrow Pay  ·  Enabled                        [...]│
│  ─────────────────────────────────────────────────  │
│  Allowed Domains                                    │
│  These are the external origins this plugin may     │
│  contact on this board. Uncheck to block a domain.  │
│                                                     │
│  ☑  https://api.stripe.com                          │
│  ☑  https://escrowpay.example.com                   │
│  ☐  https://analytics.example.com   (blocked)       │
│                                                     │
│                              [Save domain settings] │
└─────────────────────────────────────────────────────┘
```

- A domain checked = included in `allowedDomains` (or `null` if all are checked, meaning "allow all").
- A domain unchecked = excluded.
- Saving calls `PATCH /api/v1/boards/:boardId/plugins/:pluginId/allowed-domains`.
- If the plugin has no `whitelistedDomains`, the section is hidden (nothing to restrict).

**File:** `src/extensions/Plugins/components/PluginAllowedDomainsPanel.tsx`

---

### 7. Files Summary

**Server:**
```
db/migrations/
└── 0023_plugin_whitelisted_domains.ts          ← new

server/extensions/plugins/
├── common/
│   └── isValidHttpsOrigin.ts                   ← new
├── api/
│   ├── register.ts                             ← updated (whitelistedDomains field)
│   ├── update.ts                               ← updated (whitelistedDomains field)
│   └── board-allowed-domains.ts               ← new (PATCH board domains)
└── index.ts                                    ← updated (mount new route)
```

**Client:**
```
src/extensions/Plugins/
├── components/
│   └── PluginAllowedDomainsPanel.tsx           ← new
├── modals/
│   ├── EditPluginModal.tsx                     ← new
│   └── PluginModal.tsx                         ← updated (add AllowedDomainsPanel)
└── containers/
    └── PluginDashboardPage/
        ├── PluginDashboardPage.tsx             ← updated (edit button for admins)
        └── PluginDashboardPage.duck.ts         ← updated (updatePluginThunk)
```

---

### 8. Type Updates

**`src/extensions/Plugins/types.ts`** (or equivalent):

```typescript
export interface Plugin {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  connectorUrl: string;
  manifestUrl: string | null;
  author: string | null;
  authorEmail: string | null;
  supportEmail: string | null;
  categories: string[];
  capabilities: Record<string, { name: string; description: string }> | null;
  isPublic: boolean;
  isActive: boolean;
  whitelistedDomains: string[] | null;    // ← new
  createdAt: string;
  updatedAt: string;
}

export interface BoardPluginConfig {
  allowedDomains: string[] | null;        // ← new; null = inherit all plugin domains
}
```

---

### 9. Acceptance Criteria

**Plugin domain declaration (platform admin)**

- [ ] `POST /api/v1/plugins` with `whitelistedDomains: ["https://api.stripe.com"]` persists the domains.
- [ ] `POST /api/v1/plugins` with an `http://` domain returns `invalid-whitelisted-domain` 422.
- [ ] `POST /api/v1/plugins` with 21 domains returns `too-many-whitelisted-domains` 422.
- [ ] `PATCH /api/v1/plugins/:id` with a new domain list replaces the existing list.
- [ ] `PATCH /api/v1/plugins/:id` with `whitelistedDomains: []` clears the list.
- [ ] `GET /api/v1/plugins` response includes `whitelistedDomains` for every plugin.

**Board domain allowlist**

- [ ] `PATCH .../allowed-domains` with a valid subset persists to `board_plugins.config.allowedDomains`.
- [ ] `PATCH .../allowed-domains` with `null` sets `allowedDomains: null` (inherit all).
- [ ] `PATCH .../allowed-domains` with a domain not in the plugin's list returns `domain-not-whitelisted-by-plugin` 422.
- [ ] `PATCH .../allowed-domains` by a non-board-admin returns 403.
- [ ] A plugin message from a blocked origin is silently discarded by the host bridge.
- [ ] `t.popup({ url: 'https://blocked.example.com/...' })` returns `domain-not-allowed` error when that origin is not in `allowedDomains`.

**Edit Plugin UI**

- [ ] Platform admin sees an "Edit" button on each plugin card in the admin list.
- [ ] Clicking "Edit" opens a pre-filled modal with current plugin values.
- [ ] Submitting changes updates the plugin and shows a "Plugin updated." toast.
- [ ] Changing `whitelistedDomains` in the edit form is reflected immediately in the Allowed Domains panel for any board that has the plugin enabled.
- [ ] A non-platform-admin does not see the "Edit" button.

**Allowed Domains Panel (board admin)**

- [ ] Panel is visible in the plugin detail modal if the plugin has `whitelistedDomains`.
- [ ] Panel is hidden if the plugin has no `whitelistedDomains`.
- [ ] Unchecking a domain and saving blocks that origin in the bridge.
- [ ] Re-checking a domain and saving re-allows it.
- [ ] "Save domain settings" is disabled when no changes have been made (pristine state).
