# Sprint 113 — Plugin Registration Global Panel

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 36 (Plugin Registry CRUD & Search), Sprint 17 (Workspace Dashboard)
> **Architecture reference:** [`specs/architecture/plugins.md`](../architecture/plugins.md)

---

## Goal

Right now the only way to access plugin management is from within a specific board's settings panel. This is the wrong mental model — plugins are platform-level resources, not board-level ones. This sprint elevates plugin management to a **first-class global panel** accessible from the main sidebar, giving platform admins a single place to register, edit, and deactivate plugins independently of any board.

When this sprint is done, a platform admin can navigate directly to `/plugins` from the sidebar, register a new plugin (generating a one-time API key), edit metadata, and deactivate plugins — without ever opening a board.

---

## Scope

---

### 1. Server — No new endpoints required

All CRUD endpoints (`POST/PATCH/DELETE /api/v1/plugins`, `GET /api/v1/plugins`) were delivered in Sprint 36. This sprint is purely a client-side lift.

One small server addition: expose `GET /api/v1/plugins/:pluginId` (single plugin fetch by ID) if not already present, to support the Edit modal loading its own data without re-fetching the whole list.

#### `GET /api/v1/plugins/:pluginId`

- **Auth:** Platform admin only.
- **Success:** `200` `{ data: Plugin }` — same shape as the list item but includes all optional fields.
- **Error:** `404` `{ error: { name: 'plugin-not-found' } }` if not found or inactive.

---

### 2. Client — Global Plugin Registry Page

#### Route

`/plugins`

Accessible only to platform admins. Non-admins who navigate here are redirected to `/` with a toast: _"You don't have permission to manage plugins."_

#### Sidebar entry

Add a **"Plugins"** entry to the main sidebar, visible only when the user has the `platform_admin` role. Place it below workspace navigation, in an "Administration" section.

```
Sidebar (platform admin only):
  ─ Administration ─
  [Puzzle icon] Plugins
```

#### Page layout

```
┌────────────────────────────────────────────────────────────────┐
│  Plugin Registry                          [+ Register Plugin]  │
│  Manage the plugins available across all boards.               │
├────────────────────────────────────────────────────────────────┤
│  [Search...]   [Category ▾]   [Status: Active ▾]              │
├────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐    │
│  │ [icon] Plugin Name       author@email.com   [Edit] [⊗] │    │
│  │        description text                                 │    │
│  │        chips: payments  finance                        │    │
│  └────────────────────────────────────────────────────────┘    │
│  … more rows …                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### Plugin row actions

| Action | Behaviour |
|--------|-----------|
| **Edit** | Opens `EditPluginModal` (pre-filled with current data — Sprint 39 already specced this; re-use/adapt) |
| **Deactivate (⊗)** | Calls `DELETE /api/v1/plugins/:pluginId` (soft-deactivate); confirms with an inline "Are you sure?" inline prompt before firing |
| **Reactivate** | For inactive plugins shown when "Status: Inactive" filter selected; calls `PATCH` with `{ isActive: true }` |

#### Register Plugin modal

Triggered by **"+ Register Plugin"** button. Form fields (all match Sprint 36 POST body):

| Field | Input type | Required |
|-------|-----------|---------|
| Plugin Name | text | ✅ |
| Slug | text (auto-generated from name, editable) | ✅ |
| Description | textarea | |
| Icon URL | text (HTTPS) | |
| Connector URL | text (HTTPS) | ✅ |
| Manifest URL | text (HTTPS) | |
| Author | text | |
| Author Email | email | |
| Support Email | email | |
| Categories | tag input (comma-separated) | |
| Public | toggle | |

On success:
1. Close the form step.
2. Show a **one-time API Key reveal step** — a modal step with the generated `api_key` in a readonly input + copy button. Warn: _"This key will never be shown again."_
3. After closing the reveal, the new plugin appears at the top of the registry table.

---

### 3. Files — Client

```
src/extensions/Plugins/
├── containers/
│   └── PluginRegistryPage/
│       ├── PluginRegistryPage.tsx          ← page shell, admin guard, list + search
│       └── PluginRegistryPage.duck.ts      ← RTK actions: fetchPlugins, deletePlugin, reactivatePlugin
├── components/
│   ├── PluginRegistryTable.tsx             ← table of plugins with edit/deactivate actions
│   ├── PluginRegistryRow.tsx               ← single row: icon, name, description, chips, actions
│   ├── RegisterPluginModal.tsx             ← two-step form: fill details → reveal API key
│   ├── PluginApiKeyReveal.tsx              ← read-only key box with copy-to-clipboard + warning
│   └── PluginSearchBar.tsx                 ← search input + category + status filter dropdowns
├── routes.ts                               ← add /plugins route (admin only)
└── api.ts                                  ← add fetchPlugin(id), deletePlugin(id), reactivatePlugin(id)
```

---

### 4. Acceptance Criteria

| # | Scenario | Expected |
|---|----------|---------|
| AC-1 | Platform admin navigates to `/plugins` via sidebar | Page loads with list of all active registered plugins |
| AC-2 | Platform admin clicks "+ Register Plugin", fills form, submits | Plugin created; API key shown once in reveal modal; plugin appears in list |
| AC-3 | Platform admin closes API key reveal and re-opens the same plugin via Edit | `api_key` field is absent — only a "Regenerate key" placeholder |
| AC-4 | Platform admin deactivates a plugin | Row disappears from Active list; appears in Inactive filter view |
| AC-5 | Non-admin navigates to `/plugins` directly | Redirected to `/` with "no permission" toast |
| AC-6 | Platform admin uses search bar | Results filtered in real-time via debounced `GET /api/v1/plugins?q=…` |

---

### 5. Feature Flag

Inherits `PLUGINS_ENABLED`. The sidebar entry and route are only rendered when this flag is `true`.

---

### 6. Tests

- **Integration:** `tests/integration/plugins/pluginRegistry.test.ts` — `GET /api/v1/plugins/:pluginId` (200, 404)
- **E2E:** `tests/e2e/plugin-registry-admin.spec.ts` — register plugin flow; one-time key reveal; deactivate flow
