# Sprint 37 — Plugin SDK: Context Queries, Data Storage Fix & Button Callbacks

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 34 (Plugin Server, SDK & Database), Sprint 35 (Plugin Dashboard UI & Board Integration)
> **Architecture reference:** [`specs/architecture/plugins.md`](../architecture/plugins.md)

---

## Goal

Fix three critical broken links between plugin code (client.js) and the host board UI, found by inspecting the live `plugins/sharetribe-horizon-escrow/public/js/client.js`:

1. **Context queries (`t.card()`, `t.list()`, etc.) never resolve** — the host bridge does not handle `CTX_CARD`, `CTX_LIST`, `CTX_BOARD`, `CTX_MEMBER` messages, so every capability that reads context hangs and times out silently.
2. **`t.get()` / `t.set()` always fail with 400** — the SDK does not include the `resourceId` (e.g. the current card ID for `scope='card'`) in the `DATA_GET` / `DATA_SET` message payload. The server sees no `resourceId` and returns `missing-param`.
3. **Button callbacks are never invoked** — `card-buttons` handlers return callback functions, but functions cannot be serialised through `postMessage`, so the host receives buttons without action handlers. When the user clicks a button, the host sends `BUTTON_CLICKED` to the plugin iframe but the SDK has no handler for that message type.

When this sprint is done, the escrow plugin (and any future plugin) can:
- Call `t.list()`, `t.card()`, `t.board()`, `t.member()` and receive the requested fields.
- Call `t.get(scope, visibility, key)` / `t.set(scope, visibility, key, value)` and have the correct `resourceId` resolved automatically from context.
- Define button callbacks in `initialize()` that are actually invoked when a board user clicks the button.

---

## Scope

### 1. Fix CTX_CARD / CTX_LIST / CTX_BOARD / CTX_MEMBER in the host bridge

**File:** `src/extensions/Plugins/iframeHost/usePluginBridge.ts`

#### Root cause

The SDK sends the following messages to the host when plugin code calls context-read methods:

| SDK call | Message type sent |
|---|---|
| `t.card(...fields)` | `CTX_CARD` |
| `t.list(...fields)` | `CTX_LIST` |
| `t.board(...fields)` | `CTX_BOARD` |
| `t.member(...fields)` | `CTX_MEMBER` |

None of these appear in the `switch (data.type)` block in `usePluginBridge.ts`. The host never replies, the pending promise in the SDK waits 3 seconds (or indefinitely), and the capability handler (e.g. `card-badges`) stalls then silently returns nothing.

#### Fix — add four case handlers

Each handler reads data from the Redux store (already loaded in the board view) and returns the requested fields:

```typescript
case 'CTX_CARD': {
  const payload = data.payload as { fields: string[] };
  // The capability context was injected as args by CAPABILITY_INVOKE.
  // The card id is available in pluginState args if we stored it —
  // but a cleaner approach: the bridge passes card/list/board context
  // when resolving capabilities (see §3). Extract it from the stored
  // capability invocation context (keyed by requestId / plugin).
  // For V1: read from global board Redux state by looking up the card
  // id that was bundled into the CAPABILITY_INVOKE args.
  const cardId = resolveContextId(bp.plugin.id, 'card');
  const cardData = selectCardById(cardId); // read from Redux store
  const filtered = pickFields(cardData, payload.fields);
  sendToPlugin(bp.plugin.id, { jhSdk: true, id: data.id, result: filtered } as SdkMessage);
  break;
}
// ...same pattern for CTX_LIST, CTX_BOARD, CTX_MEMBER
```

**Context tracking** — The bridge already receives the context as `args` in `CAPABILITY_INVOKE` (it sends `{ capability, args: context, requestId }` to the plugin). The context contains `card.id`, `list.id`, `board.id`. Store this per-plugin in a `pluginContextRef` map so that when `CTX_CARD` arrives later (within the same capability invocation), the bridge knows which card to look up.

```typescript
// On CAPABILITY_INVOKE send (in resolve()):
pluginContextRef.current.set(bp.plugin.id, context); // store {card, list, board}
```

**Redux selectors needed:**

| Message | Selector |
|---|---|
| `CTX_CARD` | `selectCardById(id)` from board slice |
| `CTX_LIST` | `selectListById(id)` from board slice |
| `CTX_BOARD` | `selectBoardById(id)` from board slice |
| `CTX_MEMBER` | `selectCurrentUser()` from auth slice |

**Filtering fields:** Only return the fields the plugin requested. Do not expose full objects blindly.

```typescript
function pickFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  if (!fields || fields.length === 0) return obj;
  return Object.fromEntries(fields.filter(f => f in obj).map(f => [f, obj[f]]));
}
```

---

### 2. Fix SDK `t.get()` / `t.set()` — auto-populate `resourceId` from context args

**File:** `server/extensions/plugins/sdk/jh-instance.ts` (source) + rebuild `public/sdk/jh-instance.js`

#### Root cause

```typescript
// CURRENT — missing resourceId
get(scope: Scope, visibility: Visibility, key: string): Promise<unknown> {
  return sendToHost('DATA_GET', { scope, visibility, key });
}
```

The server requires `resourceId`. The host bridge only adds it to the API call if `msg.payload.resourceId` is present (which it isn't). The server returns `400: resourceId is required`. The bridge `catch` silently returns `null`.

#### Fix — resolve resourceId from `this.args`

```typescript
get(scope: Scope, visibility: Visibility, key: string): Promise<unknown> {
  // [why] resourceId for scope 'card' is this.args.card.id, for 'board' is this.args.board.id, etc.
  const contextObj = (this.args[scope] ?? {}) as Record<string, unknown>;
  const resourceId = (contextObj['id'] as string | undefined) ?? null;
  return sendToHost('DATA_GET', { scope, visibility, key, resourceId });
}

set(scope: Scope, visibility: Visibility, key: string, value: unknown): Promise<void> {
  const contextObj = (this.args[scope] ?? {}) as Record<string, unknown>;
  const resourceId = (contextObj['id'] as string | undefined) ?? null;
  return sendToHost('DATA_SET', { scope, visibility, key, value, resourceId }) as Promise<void>;
}
```

For `scope='member'`, `this.args.member` may not be set — the bridge should populate `this.args.member = { id: currentUserId }` inside `CAPABILITY_INVOKE` so member-scoped data works too.

**Rebuild jh-instance.js:**

After updating `server/extensions/plugins/sdk/jh-instance.ts`, rebuild the compiled bundle served at `public/sdk/jh-instance.js` (the build script already exists in the escrow plugin's `build.ts` → same pattern applies for the main SDK).

---

### 3. Fix button callbacks — SDK callback registry

**Files:**
- `server/extensions/plugins/sdk/jh-instance.ts`
- `src/extensions/Plugins/uiInjections/CardPluginButtons.tsx`
- Rebuild `public/sdk/jh-instance.js`

#### Root cause

The `card-buttons` capability handler returns button objects:

```javascript
{
  icon: MONEY_PAYING_ICON,
  text: 'Prepaid Card',
  callback: prepaidCardCallBack,   // ← function — stripped by postMessage
}
```

Functions cannot be serialised through `postMessage`. The host receives `{ icon, text, callback: undefined }`. When the user clicks the button, the host sends `BUTTON_CLICKED` to the plugin, but the SDK switch statement has no `BUTTON_CLICKED` case. The callback is never called.

#### Fix — callback registry in the SDK

**SDK side (`jh-instance.ts`):**

1. Add a `callbackRegistry` map: `Map<string, CapabilityHandler>`.
2. In the `CAPABILITY_INVOKE` handler, after the capability result is produced, scan it for `callback` function properties. For each one: register `fn` under a UUID key, replace the function with the string `{ __callbackId: uuid }` in the serialised result.
3. Add a `BUTTON_CLICKED` case to the message listener: look up the `__callbackId` in the registry, create a fresh `FrameContext` (with the context args forwarded from the click event), invoke the callback.

```typescript
// [why] Functions can't cross postMessage boundaries — we register them locally and
// expose only an opaque ID to the host.
const callbackRegistry = new Map<string, CapabilityHandler>();

// Inside CAPABILITY_INVOKE handler — serialize result
function serializeResult(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result.map(serializeResult);
  }
  if (result && typeof result === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
      if (typeof v === 'function') {
        const cbId = `cb-${crypto.randomUUID()}`;
        callbackRegistry.set(cbId, v as CapabilityHandler);
        out[k] = { __callbackId: cbId };
      } else {
        out[k] = serializeResult(v);
      }
    }
    return out;
  }
  return result;
}
```

```typescript
// In message listener
case 'BUTTON_CLICKED': {
  const payload = data.payload as { callbackId: string; args?: Record<string, unknown> };
  const fn = callbackRegistry.get(payload.callbackId);
  if (fn) {
    const t = new FrameContext(payload.args ?? {});
    void Promise.resolve(fn(t)).catch(() => {});
    // BUTTON_CLICKED has no response — fire-and-forget
  }
  break;
}
```

**Host side (`CardPluginButtons.tsx`):**

Update the click handler to extract `callbackId` from the button's `callback` field and send it in the `BUTTON_CLICKED` payload:

```typescript
interface PluginButton {
  text: string;
  icon?: string;
  callback?: { __callbackId: string }; // replaced from fn to opaque id
}

// In handleButtonClick:
bridge.sendToPlugin(bp.plugin.id, {
  jhSdk: true,
  id: `btn-${Date.now()}`,
  type: 'BUTTON_CLICKED',
  payload: {
    callbackId: button.callback?.__callbackId,
    args: {
      card: { id: cardId },
      list: { id: listId },
      board: { id: boardId },
    },
  },
});
```

**Callback IDs are ephemeral** — they are stored only for the lifetime of the `CAPABILITY_INVOKE` that created them. Old IDs from stale renders should be cleared when a new `card-buttons` resolve cycle runs for the same card. Implement a simple TTL or replace-on-reinvoke strategy.

---

### 4. Rebuild `public/sdk/jh-instance.js`

The compiled SDK file at `public/sdk/jh-instance.js` must be regenerated after changes to `server/extensions/plugins/sdk/jh-instance.ts`.

The build command is:
```bash
bun run build:sdk   # or: bun build server/extensions/plugins/sdk/jh-instance.ts \
                    #      --outfile public/sdk/jh-instance.js --target browser --minify
```

Verify the escrow plugin's `connector.html` uses the SDK from the host via the `<script>` tag — no separate copy in the plugin bundle.

---

## Acceptance Criteria

1. `t.list('id', 'name')` from within a `card-badges` handler returns `{ id: '<listId>', name: '<listName>' }`.
2. `t.card('id', 'name')` from within a modal page returns the card's id and name.
3. `t.get('card', 'private', 'paymentStatus')` returns the stored value (or `null` if unset) without a 400 error.
4. `t.set('card', 'private', 'paymentStatus', 'success')` stores the value; a subsequent `t.get` returns `'success'`.
5. Clicking the **Prepaid Card** button on a card tile opens the escrow payment modal.
6. Clicking the **Dispute** button (shown on done-list cards with `paymentStatus: 'success'`) opens the dispute modal.
7. Card badges render with the correct colour and text based on `paymentStatus` from plugin data.

---

## Files Affected

| File | Change |
|---|---|
| `src/extensions/Plugins/iframeHost/usePluginBridge.ts` | Add `CTX_CARD`, `CTX_LIST`, `CTX_BOARD`, `CTX_MEMBER` handlers; add `pluginContextRef` tracking |
| `src/extensions/Plugins/uiInjections/CardPluginButtons.tsx` | Read `button.callback.__callbackId`, send it in `BUTTON_CLICKED` payload |
| `server/extensions/plugins/sdk/jh-instance.ts` | Fix `t.get()`/`t.set()` to include `resourceId`; add `callbackRegistry`; add `BUTTON_CLICKED` handler; add `serializeResult()` |
| `public/sdk/jh-instance.js` | Rebuilt bundle |

---

## Technical Notes

- The `pluginContextRef` approach means context is shared per-plugin (last CAPABILITY_INVOKE wins). For single-plugin scenarios this is fine; multi-concurrent-capability parallel calls on the same plugin are unlikely in the card tile use case.
- The callback registry is process-memory only (no persistence). Refreshing the plugin iframe clears all registered callbacks — this is correct behaviour.
- The `member` context args (`args.member = { id }`) should be injected by the bridge in `resolve()` using the current Redux auth user, not hard-coded in the plugin.
