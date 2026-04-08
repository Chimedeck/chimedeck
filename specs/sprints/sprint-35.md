# Sprint 35 — Plugin Dashboard UI & Board Integration

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 34 (Plugin Server, SDK & Database), Sprint 18 (Board View), Sprint 19 (Card Detail Modal)
> **Architecture reference:** [`specs/architecture/plugins.md`](../architecture/plugins.md)

---

## Goal

Deliver the user-facing half of the plugin system: a **Plugin Dashboard** accessible to board admins, iframe injection into the live board view for active plugins, and all UI injection points (`card-badges`, `card-buttons`, `card-detail-badges`, `section`, `show-settings`). When this sprint is done, an admin can browse available plugins, enable them on their board, and see plugin UI appear on cards — powered by the `connector.html` → `jhInstance` → `postMessage` flow built in Sprint 34.

---

## Scope

### 1. Plugin Dashboard Page

**Route:** accessible from board settings → "Power-Ups" / "Plugins" tab (or directly at `/boards/:boardId/settings/plugins`)

**Access:** Board admin only. Non-admins who navigate to this route see a 403/redirect.

The dashboard is a two-panel layout mirroring the Atlassian App Administration portal:

```
┌──────────────────────────────────────────────────────────┐
│  Plugins                                 [+ Add a Plugin]│
├──────────────────────────────────────────────────────────┤
│  ACTIVE ON THIS BOARD                                    │
│  ┌──────┬────────────────────────────────┬─────────────┐ │
│  │ icon │ Name · description             │ [Disable]   │ │
│  │      │ categories: payments, finance  │             │ │
│  └──────┴────────────────────────────────┴─────────────┘ │
│                                                          │
│  AVAILABLE PLUGINS                                       │
│  ┌──────┬────────────────────────────────┬─────────────┐ │
│  │ icon │ Name · description             │ [Enable]    │ │
│  └──────┴────────────────────────────────┴─────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### Sections

| Section | Content |
|---|---|
| **Active on this board** | Plugins where `board_plugins.disabled_at IS NULL` for this board |
| **Available plugins** | Plugins in the registry with `is_active = true` that are not yet active on this board |

#### Plugin card

Each plugin in the list shows:
- Icon (`icon_url`) with a fallback placeholder
- Name + description
- Category chips
- Capabilities list (e.g. "Card Badges · Card Buttons · Settings")
- Author name
- **Enable** / **Disable** button (calls the board-plugin API from Sprint 34)

#### "Add a Plugin" button

Reserved for future marketplace integration. For now, renders a coming-soon tooltip. No route or modal needed.

---

### 2. Files — Client

```
src/extensions/Plugins/
├── config/
│   └── pluginsConfig.ts            ← feature flag, API base path
├── components/
│   ├── PluginCard.tsx              ← single plugin row (icon, name, description, capabilities, enable/disable)
│   ├── PluginList.tsx              ← renders active + available sections
│   └── PluginCapabilityChips.tsx   ← compact capability chip list
├── containers/
│   └── PluginDashboardPage/
│       ├── PluginDashboardPage.tsx ← page shell, auth gate
│       └── PluginDashboardPage.duck.ts ← Redux: fetchBoardPlugins, fetchAvailablePlugins, enablePlugin, disablePlugin
├── hooks/
│   └── useBoardPlugins.ts          ← thin hook wrapping the duck selectors + dispatchers
├── iframeHost/
│   ├── PluginIframeContainer.tsx   ← hidden iframe injector for ALL active plugins
│   ├── PluginIframeHost.tsx        ← single hidden <iframe> with postMessage listener
│   └── usePluginBridge.ts          ← manages postMessage to/from all plugin iframes
├── uiInjections/
│   ├── CardPluginBadges.tsx        ← renders plugin-provided card-badges on tile
│   ├── CardPluginButtons.tsx       ← renders plugin-provided card-buttons on tile
│   ├── CardDetailPluginBadges.tsx  ← renders card-detail-badges on card back
│   └── CardPluginSection.tsx       ← renders plugin-provided section on card back
├── modals/
│   ├── PluginPopup.tsx             ← small popup rendered when plugin calls t.popup()
│   └── PluginModal.tsx             ← fullscreen/standard modal for t.modal()
├── api.ts                          ← fetch wrappers for board-plugins + available-plugins endpoints
├── routes.ts                       ← registers /boards/:boardId/settings/plugins
├── reducers.ts                     ← combines plugin duck into root reducer
└── README.md
```

---

### 3. Redux Duck — `PluginDashboardPage.duck.ts`

```ts
// State shape
interface PluginsState {
  boardPlugins: BoardPluginWithPlugin[];   // active on this board
  availablePlugins: Plugin[];              // in registry, not yet enabled
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}

// Thunks
fetchBoardPlugins(boardId)        → GET /api/v1/boards/:boardId/plugins
fetchAvailablePlugins(boardId)    → GET /api/v1/plugins  (filtered client-side)
enablePlugin({ boardId, pluginId }) → POST /api/v1/boards/:boardId/plugins
disablePlugin({ boardId, pluginId }) → DELETE /api/v1/boards/:boardId/plugins/:pluginId
```

On `enablePlugin` success: move the plugin from `availablePlugins` to `boardPlugins` optimistically (revert on error).
On `disablePlugin` success: move it back.

---

### 4. Plugin Iframe Injection (Hidden Iframes)

**File:** `src/extensions/Plugins/iframeHost/PluginIframeContainer.tsx`

Mounted once at the root of the Board View (alongside the Kanban columns, not inside any card). Renders one hidden `<iframe>` per active board plugin.

```tsx
// In BoardView.tsx (Sprint 18)
<PluginIframeContainer boardId={board.id} />
```

Each iframe:
- `src` = `plugin.connectorUrl` with query params `?boardId=&pluginId=&apiKey=&origin=<our-domain>`
- `style={{ display: 'none' }}`
- `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`
- Has a stable `id` so the bridge can target it for `postMessage`

`connector.html` inside the iframe loads `<script src="https://<our-domain>/sdk/jh-instance.js">` followed by the plugin's `<script src="/client.js">`. `client.js` calls `jhInstance.initialize(...)` → SDK sends `PLUGIN_READY` back to the host.

---

### 5. `postMessage` Bridge — `usePluginBridge.ts`

Manages the two-way message channel between the board page and all plugin iframes.

**Outbound (host → iframe):** When the board needs a capability result (e.g. card-badges for card `X`), it calls `bridge.resolve('card-badges', { card, list, board })`. The bridge broadcasts a `RESOLVE_CAPABILITY` message to all active plugin iframes and collects responses.

**Inbound (iframe → host):** The bridge listens for `window.message` events. On receipt:
1. Validates `event.origin` against the plugin's registered `connector_url` origin.
2. Dispatches to the correct handler:
   - `UI_POPUP` → open `<PluginPopup>`
   - `UI_MODAL` → open `<PluginModal>`
   - `UI_CLOSE_MODAL` → close the modal
   - `UI_UPDATE_MODAL` → update modal title/fullscreen/accent
   - `UI_SIZE_TO` → resize the popup/modal iframe
   - `RESOLVE_CAPABILITY_RESPONSE` → resolve the pending promise for that capability request

```ts
// Public API of the bridge
interface PluginBridge {
  resolve(capability: string, context: CapabilityContext): Promise<any[]>;
  sendToPlugin(pluginId: string, message: SdkMessage): void;
}
```

The bridge is provided to the board via a React context (`PluginBridgeContext`) so that any component deep in the tree (e.g. `CardTile`) can call `bridge.resolve('card-badges', ctx)` without prop drilling.

---

### 6. UI Injection Points

#### Card tile — `CardPluginBadges.tsx` and `CardPluginButtons.tsx`

Mounted inside the existing `CardTile` component (Sprint 18). On mount (and when the card re-renders), calls `bridge.resolve('card-badges', ctx)` and renders the returned badge array.

Badge shape (from plugin):
```ts
{ title?: string; text?: string; icon?: string; color?: 'green'|'yellow'|'red'|'orange'|'none' }
```

Button shape (from plugin):
```ts
{ icon: string; text: string; callback: (t: FrameContext) => void }
```

Buttons are rendered as small icon+text chips below the card title. Clicking invokes the callback — the SDK translates this into a `UI_POPUP` or `UI_MODAL` message to the host.

#### Card back — `CardDetailPluginBadges.tsx` and `CardPluginSection.tsx`

Mounted inside the Card Detail Modal (Sprint 19).

`card-detail-badges`: rendered as a row of detail badges near the top of the modal.

`section` capability returns `{ title, url }`. The section is rendered as a collapsible panel with an `<iframe src={url}>` inside. The `url` is a plugin-hosted page (e.g. `section.html`) that calls `jhInstance.iframe()` to get its context.

---

### 7. Plugin Popup & Modal

#### `PluginPopup.tsx`

Small floating popup anchored near the triggering element. Contains an `<iframe src={options.url}>` sized to fit. Closed on outside click or when the plugin calls `t.closePopup()`.

#### `PluginModal.tsx`

Standard modal overlay. Can be full-screen when `options.fullscreen = true`. Title and accent colour are controllable via `t.updateModal(...)`. Contains an `<iframe src={options.url}>` that loads a plugin page (e.g. `modal.html`, `settings.html`, `dispute.html`). These pages call `jhInstance.iframe()` (not `jhInstance.initialize`).

---

### 8. Board Settings Tab

**File:** `src/extensions/Board/containers/BoardSettings/` (existing, from Sprint 05 or later)

Add a "Plugins" tab entry that navigates to the `PluginDashboardPage`. Only visible to board admins (checked client-side; server enforces).

---

### 9. `show-settings` Capability

When the user clicks a gear icon next to an active plugin in the dashboard, the bridge calls `bridge.resolve('show-settings', ctx)`. If the plugin returns a URL, opens `<PluginModal url={url} title="Settings">`. This loads the plugin's `settings.html` (which calls `jhInstance.iframe()` to interact with board/card data and persist config via `t.set`).

---

## Capability → Component Map

| Capability | Where rendered | Component |
|---|---|---|
| `card-badges` | Card tile | `CardPluginBadges` |
| `card-detail-badges` | Card modal header | `CardDetailPluginBadges` |
| `card-buttons` | Card tile, below title | `CardPluginButtons` |
| `section` | Card modal body | `CardPluginSection` |
| `show-settings` | Plugin dashboard gear icon | `PluginModal` (url from capability) |
| `authorization-status` | Plugin dashboard row | Inline authorized/not indicator |
| `show-authorization` | Dashboard "Authorize" click | `PluginModal` (url from capability) |

---

## Runtime Flow (end-to-end)

```
1. Board admin opens Settings → Plugins tab
   └── fetchBoardPlugins + fetchAvailablePlugins load from API

2. Admin clicks [Enable] on "Pay2Paid" plugin
   └── POST /api/v1/boards/:boardId/plugins { pluginId }
   └── Plugin moves to "Active" section in dashboard

3. Board view re-renders
   └── PluginIframeContainer reads boardPlugins from Redux
   └── Injects <iframe src="https://escrow.jhorizon.io/connector.html?..."> (hidden)
   └── iframe loads connector.html:
         <script src="/sdk/jh-instance.js">   ← our SDK
         <script src="/js/client.js">          ← plugin code
   └── client.js calls:
         PowerUp.initialize({            ← aliased to jhInstance
           'card-badges': async (t) => {...},
           'card-buttons': async (t) => {...},
           'card-detail-badges': async (t) => {...},
         }, { appKey, appName })
   └── SDK sends PLUGIN_READY to host

4. User opens a card tile
   └── CardPluginBadges mounts
   └── bridge.resolve('card-badges', { card, list, board })
   └── Host posts RESOLVE_CAPABILITY to plugin iframe
   └── Plugin calls t.get('card','private','paymentStatus')
         → SDK fetches GET /api/v1/plugins/data?scope=card&resourceId=:id&key=paymentStatus&visibility=private
   └── Plugin returns badge array [{ text: 'Pending', icon: '...', color: 'yellow' }]
   └── Host renders badge on card tile

5. User clicks "Prepaid Card" button
   └── Plugin callback calls t.modal({ title: 'Prepaid Card', url: '/api-client-authorize.html' })
   └── SDK sends UI_MODAL to host
   └── Host renders <PluginModal> with <iframe src="https://escrow.jhorizon.io/api-client-authorize.html">
   └── That page calls jhInstance.iframe() to get context
```

---

## File Summary

| File | New / Modified |
|---|---|
| `src/extensions/Plugins/config/pluginsConfig.ts` | New |
| `src/extensions/Plugins/api.ts` | New |
| `src/extensions/Plugins/reducers.ts` | New |
| `src/extensions/Plugins/routes.ts` | New |
| `src/extensions/Plugins/README.md` | New |
| `src/extensions/Plugins/components/PluginCard.tsx` | New |
| `src/extensions/Plugins/components/PluginList.tsx` | New |
| `src/extensions/Plugins/components/PluginCapabilityChips.tsx` | New |
| `src/extensions/Plugins/containers/PluginDashboardPage/PluginDashboardPage.tsx` | New |
| `src/extensions/Plugins/containers/PluginDashboardPage/PluginDashboardPage.duck.ts` | New |
| `src/extensions/Plugins/hooks/useBoardPlugins.ts` | New |
| `src/extensions/Plugins/iframeHost/PluginIframeContainer.tsx` | New |
| `src/extensions/Plugins/iframeHost/PluginIframeHost.tsx` | New |
| `src/extensions/Plugins/iframeHost/usePluginBridge.ts` | New |
| `src/extensions/Plugins/uiInjections/CardPluginBadges.tsx` | New |
| `src/extensions/Plugins/uiInjections/CardPluginButtons.tsx` | New |
| `src/extensions/Plugins/uiInjections/CardDetailPluginBadges.tsx` | New |
| `src/extensions/Plugins/uiInjections/CardPluginSection.tsx` | New |
| `src/extensions/Plugins/modals/PluginPopup.tsx` | New |
| `src/extensions/Plugins/modals/PluginModal.tsx` | New |
| `src/extensions/reducers.ts` | Modified — add plugin reducer |
| `src/extensions/extensions.ts` | Modified — register Plugins routes |
| `src/containers/BoardView/BoardView.tsx` | Modified — mount `PluginIframeContainer` |
| `src/containers/CardTile/CardTile.tsx` | Modified — mount `CardPluginBadges`, `CardPluginButtons` |
| `src/containers/CardModal/CardModal.tsx` | Modified — mount `CardDetailPluginBadges`, `CardPluginSection` |

---

## Acceptance Criteria

- [ ] A board admin can open the Plugins tab in board settings.
- [ ] Available plugins are listed and can be enabled with one click.
- [ ] Enabling a plugin creates a `board_plugins` record and moves the plugin to "Active" without page reload.
- [ ] Disabling a plugin sets `disabled_at`; the iframe is removed from the DOM within one render cycle.
- [ ] Navigating back to the board after enabling a plugin shows the plugin iframe injected (hidden) in the DOM.
- [ ] `connector.html` loads, `client.js` runs `initialize(...)` (with shim), and `PLUGIN_READY` is received by the host within 3 seconds.
- [ ] Card tiles display `card-badges` returned by the plugin.
- [ ] Card tiles display `card-buttons`; clicking a button triggers the plugin callback and opens a `PluginModal`.
- [ ] Card detail modal displays `card-detail-badges` and a `section` panel when those capabilities are registered.
- [ ] `show-settings` gear icon opens a `PluginModal` loaded with the plugin's settings URL.
- [ ] `t.set` / `t.get` calls from within a plugin modal page persist and retrieve correctly.
- [ ] Non-admin users cannot reach the Plugins dashboard (client redirect + server 403).
- [ ] Origin validation: a postMessage from an unexpected origin is silently ignored (no console error, no state change).
- [ ] All new components have corresponding unit tests; bridge integration covered by one end-to-end test.
