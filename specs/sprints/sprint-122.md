# Sprint 122 — Multi-Instance User Notification Delivery via Pub/Sub

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 20 (Real-Time UI), Sprint 51 (WebSocket Auth), Sprint 72 (Notifications)
> **Status:** ⬜ Future

---

## Goal

`publishToUser` currently reads directly from the in-process `userSockets` map to deliver notifications to a specific user's WebSocket connections. This works on a single server instance but silently drops notifications on any multi-instance deployment: if a user's socket lives on instance B and the mutation fires on instance A, instance A's `userSockets` has no entry for that user and the notification is lost.

This sprint routes `publishToUser` through the existing Redis pub/sub layer — the same architecture already used for board room broadcasts and session revocation — so that any instance publishing a user notification reaches the correct socket regardless of which instance it is connected to.

After this sprint, the server can be horizontally scaled behind a load balancer (no sticky sessions required) without losing any user-targeted real-time notifications.

---

## Background

### What already works correctly with Redis enabled

| Path | Mechanism | Multi-instance safe? |
|------|-----------|----------------------|
| Board room events | `publisher.publish('board:<id>')` → Redis fan-out → each instance's `subscriber.subscribeBoard` handler → local `broadcast()` | ✅ Yes |
| Session revocation | `pubsub.publish('session:<userId>')` → each instance closes local sockets for that user | ✅ Yes |
| Presence cache | `RedisCacheAdapter` — shared across instances | ✅ Yes |
| User notifications | `publishToUser` reads in-process `userSockets` only | ❌ No |

### The bug

```
Instance A                        Instance B
─────────────────────             ─────────────
User Alice connected here         User Bob connected here

Bob assigns a card to Alice
  → mapActivityToNotification()
  → publishToUser('alice', msg)
  → reads userSockets.get('alice')
  → undefined (Alice is on B)
  → notification silently dropped
```

---

## Scope

### 1. Route `publishToUser` through pubsub

**File: `server/extensions/realtime/userChannel.ts`**

Add a pubsub subscription layer mirroring the pattern in `sessionRevocation.ts`:

```ts
// server/extensions/realtime/userChannel.ts
import { pubsub } from '../../mods/pubsub/index';
import type { WsData } from './mods/rooms/index';
import type { ServerWebSocket } from 'bun';

export const userSockets = new Map<string, Set<ServerWebSocket<WsData>>>();

// Track which userIds this instance has an active pubsub subscription for.
// Mirrors subscribedUsers in sessionRevocation.ts — one pubsub entry per user,
// not per socket (a user may have multiple tabs open).
const subscribedUserChannels = new Set<string>();

export function registerUserSocket(ws: ServerWebSocket<WsData>): void {
  const { userId } = ws.data;
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(ws);
}

export function deregisterUserSocket(ws: ServerWebSocket<WsData>): void {
  const { userId } = ws.data;
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) userSockets.delete(userId);
}

/**
 * Subscribe this instance to the user's personal pub/sub channel.
 * Idempotent — calling multiple times for the same user (multiple tabs) is safe.
 * Must be called after registerUserSocket so the socket is already in userSockets.
 */
export async function subscribeUserChannel(userId: string): Promise<void> {
  if (subscribedUserChannels.has(userId)) return;
  subscribedUserChannels.add(userId);

  await pubsub.subscribe(`user:${userId}`, (message) => {
    const sockets = userSockets.get(userId);
    if (!sockets) return;
    for (const ws of sockets) {
      try {
        ws.send(message);
      } catch {
        // Dead socket — will be cleaned up by heartbeat
      }
    }
  });
}

/**
 * Unsubscribe this instance from the user's pub/sub channel.
 * Only unsubscribes when no more local sockets remain for this user.
 */
export async function unsubscribeUserChannel(userId: string): Promise<void> {
  const sockets = userSockets.get(userId);
  if (sockets && sockets.size > 0) return; // other tabs still open

  subscribedUserChannels.delete(userId);
  await pubsub.unsubscribe(`user:${userId}`);
}

/**
 * Publish a notification to a user.
 * Routes through pub/sub so all instances receive it — each delivers to its own
 * local sockets for that user. With Redis enabled this is multi-instance safe.
 * With InMemoryPubSubAdapter (local dev / single instance) it works identically.
 */
export async function publishToUser(userId: string, message: object): Promise<void> {
  await pubsub.publish(`user:${userId}`, JSON.stringify(message));
}
```

**Key design decisions:**
- `publishToUser` becomes `async` — required because `pubsub.publish` is async
- Channel name `user:<userId>` is distinct from `session:<userId>` used by session revocation — no collision
- The subscription handler delivers to local sockets only; Redis fans the message to all instances
- `subscribedUserChannels` guard ensures a single `pubsub.subscribe` call per user per instance, respecting the `RedisPubSubAdapter`'s one-handler-per-channel constraint

---

### 2. Hook into WebSocket lifecycle

**File: `server/extensions/realtime/api/index.ts`**

```ts
// open handler — after existing registerUserSocket / subscribeSessionRevocation calls
subscribeUserChannel(ws.data.userId).catch(() => {});

// close handler — after existing deregisterUserSocket call
unsubscribeUserChannel(ws.data.userId).catch(() => {});
```

Import additions:
```ts
import { registerUserSocket, deregisterUserSocket, subscribeUserChannel, unsubscribeUserChannel } from '../userChannel';
```

Call order in `open`:
1. `registerUserSocket(ws)` ← must come first so the socket is in `userSockets` before the pubsub handler fires
2. `subscribeUserChannel(ws.data.userId)` ← idempotent, safe after register

Call order in `close`:
1. `deregisterUserSocket(ws)` ← must come first so the socket count is updated
2. `unsubscribeUserChannel(ws.data.userId)` ← checks updated count to decide whether to unsubscribe

---

### 3. Update all `publishToUser` call sites

`publishToUser` changes from `void` to `Promise<void>`. All callers must await it.

| File | Change |
|------|--------|
| `server/extensions/activity/mods/mapActivityToNotification.ts` | `await publishToUser(...)` |
| `server/extensions/notifications/mods/createNotifications.ts` | `await publishToUser(...)` |
| `server/extensions/notifications/mods/boardActivityDispatch.ts` | `await publishToUser(...)` |
| `server/extensions/events/mods/publishBoardDeleted.ts` | `await publishToUser(...)` |

All four call sites are already inside `async` functions, so adding `await` requires no structural change.

---

### 4. Add a `RedisPubSubAdapter` multi-handler guard (defensive hardening)

**File: `server/mods/pubsub/adapters/redis.ts`**

The current adapter silently overwrites a handler if `subscribe()` is called twice for the same channel:

```ts
// Current — unsafe if called twice on same channel
this.handlers.set(channel, handler); // overwrites silently
```

Add a guard to handle duplicate `subscribe()` calls gracefully:

```ts
async subscribe(channel: string, handler: (msg: string) => void): Promise<void> {
  // If already subscribed (e.g. after hot-reload the handler map survives but
  // caller-side room state is reset), just update the handler in place — the
  // Redis SUBSCRIBE was already issued and ioredis keeps it alive.
  if (this.handlers.has(channel)) {
    this.handlers.set(channel, handler);
    return;
  }
  this.handlers.set(channel, handler);
  await this.sub.subscribe(channel);
}
```

This handles the hot-reload scenario where the Redis singleton's `handlers` map survives but caller-side state (e.g. `rooms`) is reset, causing a re-subscribe on the same channel.

---

## Files Affected

| File | Action |
|------|--------|
| `server/extensions/realtime/userChannel.ts` | **Update** — add pubsub routing, `subscribeUserChannel`, `unsubscribeUserChannel`, `publishToUser` becomes async |
| `server/extensions/realtime/api/index.ts` | **Update** — call `subscribeUserChannel` on open, `unsubscribeUserChannel` on close |
| `server/extensions/activity/mods/mapActivityToNotification.ts` | **Update** — `await publishToUser` |
| `server/extensions/notifications/mods/createNotifications.ts` | **Update** — `await publishToUser` |
| `server/extensions/notifications/mods/boardActivityDispatch.ts` | **Update** — `await publishToUser` |
| `server/extensions/events/mods/publishBoardDeleted.ts` | **Update** — `await publishToUser` |
| `server/mods/pubsub/adapters/redis.ts` | **Update** — add duplicate-subscribe guard |

---

## Acceptance Criteria

- [ ] `publishToUser` calls `pubsub.publish('user:<userId>', ...)` — not `ws.send()` directly
- [ ] `subscribeUserChannel` is called once per user per instance (idempotent across multiple tabs)
- [ ] `unsubscribeUserChannel` only unsubscribes when no more local sockets remain for that user
- [ ] All 4 call sites `await publishToUser(...)`
- [ ] `RedisPubSubAdapter.subscribe` called twice for the same channel updates the handler in place without throwing or re-issuing SUBSCRIBE to Redis
- [ ] With `FLAG_USE_REDIS=false` (in-memory adapter, local dev / single instance): behaviour is unchanged
- [ ] Manual smoke test with two server instances pointing to the same Redis: a card assignment notification is received on the socket connected to the other instance
