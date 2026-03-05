# Sprint 36 — Plugin Registry: Registration UI & Search

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 34 (Plugin Server, SDK & Database), Sprint 35 (Plugin Dashboard UI)
> **Architecture reference:** [`specs/architecture/plugins.md`](../architecture/plugins.md)

---

## Goal

Make the plugin registry self-service. Right now the only way to register a plugin is via raw SQL. This sprint adds:

1. **Server** — a `POST /api/v1/plugins` endpoint (platform admin only) to register a new plugin, a `PATCH /api/v1/plugins/:pluginId` endpoint to update it, a `DELETE /api/v1/plugins/:pluginId` to remove it, and search + filter support on `GET /api/v1/plugins`.
2. **Client** — a **Register Plugin** modal accessible from the Plugin Dashboard's "Add a Plugin" button (platform admin only), and a **search + category filter** bar inside the Plugin Dashboard so board admins can find plugins quickly.

When this sprint is done, a platform admin can open the Plugin Dashboard on any board, click **"Add a Plugin"**, fill in a form, and have the plugin appear in the registry immediately — no SQL required.

---

## Scope

---

### 1. Server — Registry CRUD & Search

#### `POST /api/v1/plugins`

Creates a new plugin in the registry.

- **Auth:** Platform admin only (`platformAdminGuard` middleware — see §5).
- **Body:**

```ts
{
  name: string;           // required
  slug: string;           // required, unique, URL-safe, /^[a-z0-9-]+$/
  description?: string;
  iconUrl?: string;
  connectorUrl: string;   // required, must be a valid HTTPS URL
  manifestUrl?: string;   // optional HTTPS URL
  author?: string;
  authorEmail?: string;
  supportEmail?: string;
  categories?: string[];
  capabilities?: Record<string, { name: string; description: string }>;
  isPublic?: boolean;     // default false
}
```

- **Success:** `201` `{ data: Plugin }`
- **Errors:**

| Name | Status | When |
|------|--------|------|
| `plugin-slug-taken` | 409 | `slug` already exists |
| `invalid-connector-url` | 422 | `connectorUrl` is not a valid HTTPS URL |
| `validation-error` | 422 | Missing required fields |

- **Side effect:** Generates and stores a random `api_key` (CUID2 or `crypto.randomUUID()`). Returns the `api_key` in the response **once only** — it is never returned again in subsequent GET responses.

#### `PATCH /api/v1/plugins/:pluginId`

Partially updates a plugin. Same auth guard. Same shape as POST body but all fields optional. Returns the updated plugin (without `api_key`).

#### `DELETE /api/v1/plugins/:pluginId`

Soft-deactivates the plugin (`is_active = false`, `updated_at = NOW()`). Does not hard-delete to preserve board history. Returns `{ data: {} }`.

**Error:** `plugin-not-found` 404 if the plugin doesn't exist.

#### `GET /api/v1/plugins` — search & filter

Extend the existing endpoint with query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `q` | `string` | Full-text search on `name`, `description`, `author` (case-insensitive `ILIKE %q%`) |
| `category` | `string` | Filter to plugins containing this value in the `categories` array |
| `isPublic` | `boolean` | `true` → public only, `false` → all (default for platform admins) |
| `page` | `number` | 1-based page. Default `1`. |
| `perPage` | `number` | Max 50. Default `20`. |

Response shape:

```ts
{
  data: Plugin[];
  metadata: {
    totalPage: number;
    perPage: number;
    page: number;
    total: number;
  };
}
```

#### `GET /api/v1/plugins/categories`

Returns the deduplicated list of all category strings across all active plugins. Used to populate the filter dropdown.

```ts
{ data: string[] }
```

---

### 2. Server — `platformAdminGuard` Middleware

File: `server/middlewares/platformAdminGuard.ts`

A new middleware that checks whether the authenticated user has a `platform_admin` flag. For now, platform admins are identified by an environment variable (`PLATFORM_ADMIN_EMAILS`) containing a comma-separated list of emails. If the caller's email is not in the list, respond `403` with `{ name: 'not-platform-admin' }`.

```ts
// server/config/platformAdmin.ts
export const platformAdminEmails: string[] = (
  Bun.env.PLATFORM_ADMIN_EMAILS ?? ''
).split(',').map((e) => e.trim()).filter(Boolean);
```

---

### 3. Files — Server

```
server/
└── extensions/
    └── plugins/
        └── api/
            ├── index.ts           ← wire new routes: POST, PATCH, DELETE, search params on GET
            ├── get.ts             ← extend with q / category / isPublic / page / perPage
            ├── create.ts          ← POST /api/v1/plugins handler
            ├── update.ts          ← PATCH /api/v1/plugins/:pluginId handler
            ├── remove.ts          ← DELETE /api/v1/plugins/:pluginId handler
            └── categories.ts      ← GET /api/v1/plugins/categories handler
server/
└── middlewares/
    └── platformAdminGuard.ts      ← new
server/
└── config/
    └── platformAdmin.ts           ← new (reads PLATFORM_ADMIN_EMAILS)
```

---

### 4. Client — Register Plugin Modal

**Trigger:** The "Add a Plugin" button in `PluginDashboardPage` (currently disabled with a "coming soon" tooltip). Enabled only when the current user is a platform admin. For non-admins the button remains disabled.

**File:** `src/extensions/Plugins/modals/RegisterPluginModal.tsx`

#### Form fields

| Field | Input type | Required | Notes |
|-------|-----------|----------|-------|
| Plugin name | `text` | ✓ | |
| Slug | `text` | ✓ | Auto-derived from name, editable, validated `/^[a-z0-9-]+$/` |
| Description | `textarea` | | |
| Connector URL | `url` | ✓ | Must start with `https://` |
| Manifest URL | `url` | | |
| Icon URL | `url` | | Preview rendered next to field if valid |
| Author | `text` | | |
| Author email | `email` | | |
| Support email | `email` | | |
| Categories | tag input | | Comma-separated or press Enter to add chip |
| Public | `checkbox` | | Default unchecked |

#### Post-submission

On success, show the generated `api_key` in a **one-time reveal modal** — a dismissible panel with a `Copy` button (similar to GitHub PAT display). Warn the user it will never be shown again.

After dismissal, the new plugin appears at the top of the **Available plugins** list.

#### Redux

Extend `PluginDashboardPage.duck.ts`:

```ts
// New thunk
registerPluginThunk: createAsyncThunk('plugins/register', async (body) => ...)

// New state slice
registerStatus: 'idle' | 'loading' | 'error'
registerError: string | null
newApiKey: string | null   // stored only in memory until modal is dismissed
```

---

### 5. Client — Search & Filter Bar

**Location:** Top of the Plugin Dashboard page, above the "Active on this board" section.

```
┌─────────────────────────────────────────────────┐
│ 🔍 Search plugins…            [Category ▾]      │
└─────────────────────────────────────────────────┘
```

- **Search input** — debounced 300 ms, calls `GET /api/v1/plugins?q=…`
- **Category dropdown** — populated from `GET /api/v1/plugins/categories`. Selecting a category appends `&category=payments` etc.
- Results filter both the "Available plugins" section and (if searching) the "Active on this board" section.
- Empty state: "No plugins match your search." with a clear button.

**File:** `src/extensions/Plugins/components/PluginSearchBar.tsx`

Extend `PluginDashboardPage.duck.ts` with:

```ts
searchQuery: string
selectedCategory: string | null
```

And update `fetchAvailablePluginsThunk` to accept and forward these params.

---

### 6. Files — Client

```
src/extensions/Plugins/
├── components/
│   └── PluginSearchBar.tsx            ← new: search input + category dropdown
├── modals/
│   ├── PluginModal.tsx                ← existing
│   ├── RegisterPluginModal.tsx        ← new: register form
│   └── ApiKeyRevealModal.tsx          ← new: one-time api_key display
└── containers/
    └── PluginDashboardPage/
        ├── PluginDashboardPage.tsx    ← wire search bar, unlock "Add a Plugin" for admins
        └── PluginDashboardPage.duck.ts ← add registerPlugin thunk + search state
```

---

### 7. Platform Admin Detection (Client)

Add a `isPlatformAdmin` selector derived from the authenticated user's email vs a `VITE_PLATFORM_ADMIN_EMAILS` env var (comma-separated, read at build time). This is a client-side hint only — the server always re-validates via `platformAdminGuard`.

```ts
// src/extensions/Auth/utils/isPlatformAdmin.ts
export const isPlatformAdmin = (email: string | undefined): boolean => {
  const adminEmails = (import.meta.env.VITE_PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e: string) => e.trim())
    .filter(Boolean);
  return !!email && adminEmails.includes(email);
};
```

---

### 8. Acceptance Criteria

**Plugin registration (platform admin)**

- [ ] A platform admin can open the Register Plugin modal from the Plugin Dashboard.
- [ ] Submitting a valid form creates a plugin and shows the `api_key` once.
- [ ] Submitting a duplicate slug shows an inline `plugin-slug-taken` error.
- [ ] Submitting an invalid `connectorUrl` shows a validation error on the field.
- [ ] A non-admin user sees the "Add a Plugin" button as disabled.
- [ ] The newly registered plugin appears in the Available plugins list immediately after the api_key modal is dismissed.

**Search & filter**

- [ ] Typing in the search box filters the Available plugins list in ≤ 300 ms (debounced).
- [ ] Selecting a category from the dropdown further filters results.
- [ ] Clearing the search restores the full list.
- [ ] An empty result set shows "No plugins match your search." with a clear button.
- [ ] The category dropdown is populated from the live API (`/api/v1/plugins/categories`).

**Server**

- [ ] `POST /api/v1/plugins` without `platformAdminGuard` credentials returns 403.
- [ ] `GET /api/v1/plugins?q=foo` returns only matching plugins.
- [ ] `GET /api/v1/plugins?category=payments` returns only plugins in that category.
- [ ] `GET /api/v1/plugins/categories` returns deduplicated category list.
- [ ] `DELETE /api/v1/plugins/:id` sets `is_active = false`; plugin no longer appears for board admins.

---

### 9. Environment Variables

| Variable | Side | Description |
|----------|------|-------------|
| `PLATFORM_ADMIN_EMAILS` | Server | Comma-separated emails granted platform-admin access |
| `VITE_PLATFORM_ADMIN_EMAILS` | Client | Same list, exposed at build time for UI hint only |

Add both to `.env.template`.
