# Sprint 114 — Board Plugin Discovery & Enable Flow

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 113 (Plugin Registration Global Panel), Sprint 35 (Plugin Dashboard UI)
> **Architecture reference:** [`specs/architecture/plugins.md`](../architecture/plugins.md)

---

## Goal

With Sprint 113 delivering a top-level plugin registry, boards now need a proper **browse-and-enable** experience instead of ad-hoc in-board creation. This sprint replaces the old board-by-board plugin creation flow with a clean **discovery panel**: board admins browse the global registry from within a board's Plugin tab, enable plugins with a single click, and manage their active plugins — all without touching the registry itself.

When this sprint is done, the flow is:
1. Platform admin registers a plugin globally (Sprint 113).
2. Board admin opens the board's Plugins panel, browses available plugins, enables the ones they want.
3. Board admin can disable plugins per board without affecting other boards.

---

## Scope

---

### 1. Server — Discovery Endpoint

Most board-plugin endpoints already exist from Sprint 34. Add one convenience endpoint to surface the full discovery model in a single request.

#### `GET /api/v1/boards/:boardId/plugins/available`

Returns all globally active plugins (`is_active = true`) that are **not yet enabled** on this board (i.e. no row in `board_plugins` for this board+plugin, or `disabled_at IS NOT NULL`).

- **Auth:** Board member (any role).
- **Query params:** `q` (search), `category` (filter) — same as registry search.
- **Success:** `200` `{ data: Plugin[], metadata: { total: number } }`
- **Error:** `404` `{ error: { name: 'board-not-found' } }` if board doesn't exist or caller lacks access.

This endpoint powers the "Available Plugins" section without requiring the client to diff two separate lists.

---

### 2. Client — Plugin Dashboard Overhaul (Board Panel)

The board-level Plugin Dashboard (introduced in Sprint 35 at `/boards/:boardId/settings/plugins`) is updated to reflect the global-registry model.

#### Old flow (removed)
- "Add a Plugin" button → coming-soon tooltip.
- No ability to browse or enable plugins from within the board.

#### New flow

```
┌──────────────────────────────────────────────────────────────┐
│  Plugins for this board                                       │
├──────────────────────────────────────────────────────────────┤
│  ENABLED ON THIS BOARD                                        │
│  ┌─────┬───────────────────────────────┬──────────────────┐  │
│  │icon │ Name · description            │ [Settings] [Off] │  │
│  └─────┴───────────────────────────────┴──────────────────┘  │
│                                                               │
│  DISCOVER PLUGINS                                             │
│  [Search plugins...]   [Category ▾]                          │
│  ┌─────┬───────────────────────────────┬──────────────────┐  │
│  │icon │ Name · description            │ [Enable]         │  │
│  └─────┴───────────────────────────────┴──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### "Enabled on this board" section

- Shows plugins where `board_plugins.disabled_at IS NULL`.
- **Settings** button → opens `show-settings` injection (existing Sprint 35 behaviour).
- **Off / Disable** button → calls `DELETE /api/v1/boards/:boardId/plugins/:pluginId`; row moves to Discover section.

#### "Discover Plugins" section

- Fetches from `GET /api/v1/boards/:boardId/plugins/available`.
- Search and category filter query params wired to the endpoint.
- **Enable** button → calls `POST /api/v1/boards/:boardId/plugins` (Sprint 34); on success the plugin moves to the Enabled section with an optimistic update.
- If the global registry is empty, show: _"No plugins available. Ask your platform administrator to register plugins."_

#### Empty state (no enabled plugins)

```
  [Puzzle piece icon]
  No plugins enabled on this board yet.
  Browse and enable plugins below to extend this board's functionality.
```

---

### 3. Files — Client

```
src/extensions/Plugins/
├── containers/
│   └── PluginDashboardPage/
│       ├── PluginDashboardPage.tsx         ← updated: split into Enabled + Discover sections
│       └── PluginDashboardPage.duck.ts     ← add fetchAvailablePlugins thunk using new endpoint
├── components/
│   ├── EnabledPluginRow.tsx                ← row: icon, name, Settings + Disable buttons
│   ├── DiscoverPluginRow.tsx               ← row: icon, name, description, Enable button
│   └── DiscoverPluginSearch.tsx            ← search + category filter wired to available endpoint
└── api.ts                                  ← add fetchAvailablePlugins(boardId, { q, category })
```

---

### 4. Acceptance Criteria

| # | Scenario | Expected |
|---|----------|---------|
| AC-1 | Board admin opens Plugins tab; no plugins enabled | Empty state with instruction to browse plugins below |
| AC-2 | Board admin enables a plugin from the Discover section | Plugin moves immediately to Enabled section (optimistic); `POST /api/v1/boards/:boardId/plugins` called |
| AC-3 | Board admin disables an enabled plugin | Plugin moves to Discover section; `DELETE` called; other boards unaffected |
| AC-4 | Board admin searches in Discover section | Results filtered via `GET /api/v1/boards/:boardId/plugins/available?q=…` |
| AC-5 | No plugins registered globally | Discover section shows "No plugins available. Ask your platform administrator…" |
| AC-6 | Plugin that was disabled on board still appears in Discover section | `available` endpoint returns it (disabled_at IS NOT NULL counts as not enabled) |

---

### 5. Tests

- **Integration:** `tests/integration/plugins/boardPluginDiscovery.test.ts`
  - `GET /api/v1/boards/:boardId/plugins/available` — excludes already-enabled plugins
  - `POST /api/v1/boards/:boardId/plugins` then re-GET available — enabled plugin excluded
  - `DELETE` then re-GET available — disabled plugin re-appears

- **E2E:** `tests/e2e/board-plugin-discovery.spec.ts` — enable plugin on board; verify iframe injected; disable; verify removed
