# Sprint 08 — Real-Time Infrastructure

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §5.6](../architecture/requirements.md), [real_time_sync_protocol.md](../architecture/real_time_sync_protocol.md), [event_sourcing.md](../architecture/event_sourcing.md), [technical-decisions.md §§3-5, 17](../architecture/technical-decisions.md)

---

## Goal

Build the server-side real-time infrastructure: event store, WebSocket server, pub/sub fan-out (Redis or in-memory depending on `USE_REDIS` flag), and the HTTP polling fallback. This sprint does **not** wire up the frontend sync loop — that is sprint 09.

---

## Scope

### 1. Event Store — Data Model

Per [event_sourcing.md](../architecture/event_sourcing.md) + [technical-decisions.md §3](../architecture/technical-decisions.md):

```prisma
model Event {
  id        String   @id @default(cuid())
  type      String
  boardId   String?  // indexed for board-scoped subscriptions
  entityId  String
  actorId   String
  payload   Json
  sequence  BigInt   @default(autoincrement())  // ordering + optimistic lock
  createdAt DateTime @default(now())

  @@index([boardId, sequence])
}

model BoardSnapshot {
  id             String   @id @default(cuid())
  boardId        String   @unique
  state          Json     // full materialized board JSON
  lastSequence   BigInt   // highest Event.sequence included in this snapshot
  createdAt      DateTime @default(now())

  @@index([boardId, lastSequence])
}
```

Migration: `0008_events`

### 2. Event Writer

```
server/mods/events/
  write.ts      # persist Event row, return sequence
  read.ts       # fetch events since a given sequence for a boardId
  snapshot/
    write.ts    # persist BoardSnapshot
    read.ts     # load latest snapshot + events since
    policy.ts   # snapshot every N=50 events
```

Every server mutation from sprints 02–07 calls `events/write.ts` replacing the stub. This is the only sprint where back-filling previous stubs is in scope.

### 3. WebSocket Server

Per [technical-decisions.md §4](../architecture/technical-decisions.md) — Bun native WebSocket:

```
server/extensions/realtime/
  api/
    index.ts      # mounts WebSocket upgrade handler
  mods/
    rooms/
      index.ts    # Map<boardId, Set<ServerWebSocket>> — in-process room registry
      subscribe.ts
      unsubscribe.ts
      broadcast.ts
    heartbeat.ts  # 30 s ping, 60 s timeout eviction
    auth.ts       # verify Bearer token in WS handshake
```

**Client → Server messages (per [real_time_sync_protocol.md](../architecture/real_time_sync_protocol.md)):**

```ts
{ type: "subscribe",   board_id: string }
{ type: "unsubscribe", board_id: string }
{ type: "ping" }
```

**Server → Client messages:**

```ts
// All event types from event_sourcing.md
{ type: "card_created" | "card_updated" | … , entity_id, payload, actor_id, sequence, timestamp }

// Control messages
{ type: "pong" }
{ type: "session_expired" }       // on auth revocation
{ type: "error", name: string }   // protocol error
```

### 4. Pub/Sub Fan-Out — Abstracted Provider

Per [technical-decisions.md §§5, 17](../architecture/technical-decisions.md) — Redis is optional in local dev. The pub/sub layer uses a provider interface so either adapter can be used transparently.

```
server/mods/pubsub/
  types.ts          # PubSubProvider interface (from technical-decisions.md §5)
  index.ts          # resolves adapter from flags.isEnabled('USE_REDIS')
  adapters/
    redis.ts        # ioredis — PUBLISH / SUBSCRIBE per board channel
    inMemory.ts     # Node EventEmitter — single-process only
  publisher.ts      # calls provider.publish()
  subscriber.ts     # calls provider.subscribe()

server/mods/cache/
  types.ts          # CacheProvider interface
  index.ts          # resolves adapter from flags.isEnabled('USE_REDIS')
  adapters/
    redis.ts        # ioredis SET EX / GET / INCR
    nodeCache.ts    # node-cache — in-process, local dev only
```

**Adapter resolution at startup:**

```ts
// server/mods/pubsub/index.ts
import { flags } from '../flags';
import { RedisPubSubAdapter } from './adapters/redis';
import { InMemoryPubSubAdapter } from './adapters/inMemory';

const useRedis = await flags.isEnabled('USE_REDIS');
export const pubsub: PubSubProvider = useRedis
  ? new RedisPubSubAdapter(env.REDIS_URL)
  : new InMemoryPubSubAdapter();
```

**Local dev note:** `InMemoryPubSubAdapter` only fans out within the same process. Multi-node testing in local dev requires `FLAG_USE_REDIS=true` and the Redis Docker profile (`docker compose --profile redis up`).

**Flow (same for both adapters):**
1. API mutation writes `Event` row → `publisher.publish(boardId, serialisedEvent)`
2. Adapter delivers to all subscribers for that channel
3. `subscriber.ts` receives message → `rooms.broadcast(boardId, event)`
4. All WebSocket clients in that board room receive the event

### 5. HTTP Polling Fallback

Per [requirements §5.6](../architecture/requirements.md):

```
GET /api/v1/boards/:id/events?since=<sequence>
```

Returns up to 100 events since the given sequence, ordered ascending. Client polls every 3 seconds when WebSocket is unavailable.

Response:
```ts
{
  data: Event[],
  metadata: { hasMore: boolean, latestSequence: BigInt }
}
```

### 6. Presence

Per [real_time_sync_protocol.md](../architecture/real_time_sync_protocol.md) + [technical-decisions.md §§5, 17](../architecture/technical-decisions.md):

Presence storage is provided by the `CacheProvider` abstraction (same adapter selection as pub/sub):

| Operation | CacheProvider call |
|-----------|-------------------|
| User joins board | `cache.set('presence:<boardId>:<userId>', userId, 35)` |
| Heartbeat (30 s) | `cache.set(...)` refresh TTL |
| User leaves / WS closes | `cache.del('presence:<boardId>:<userId>')` |
| List active users | `cache.keys('presence:<boardId>:*')` |

- `GET /api/v1/boards/:id/presence` calls `cache.keys(...)` then fetches `User` rows — returns `{ data: User[] }`
- **Local dev (node-cache):** all keys are in-process; presence is accurate only within a single app instance which is acceptable for local dev

### 7. Connection Edge Cases

Per [requirements §9](../architecture/requirements.md):

| Scenario | Handling |
|----------|----------|
| User removed mid-session | Membership check on each `subscribe`; forceful `session_expired` send + close |
| Token expired during WS session | `ping` handler re-verifies token; on failure: `session_expired` + close |
| Disconnect mid-drag | Client queues mutation, retries on reconnect (sprint 09 implements queue) |
| Stale connection | 60 s without pong → server closes socket |

---

## Tests

- Unit: `rooms/broadcast.ts`, `pubsub/publisher.ts`, `events/snapshot/policy.ts`, both pub/sub adapter implementations, both cache adapter implementations
- Integration (no Redis): boot with `FLAG_USE_REDIS=false` → WS subscribe → mutation → event received by same-process client
- Integration (Redis): boot with `FLAG_USE_REDIS=true` + Redis container → WS subscribe → mutation → event received across two parallel app instances
- Adapter contract tests: run the same test suite against both `RedisPubSubAdapter` and `InMemoryPubSubAdapter`

---

## Acceptance Criteria

- [ ] Every mutation in sprints 02–07 now writes ≥ 1 `Event` row with correct `type`
- [ ] WS client subscribing to a board receives events — with **both** `FLAG_USE_REDIS=false` (node-cache) and `FLAG_USE_REDIS=true` (Redis)
- [ ] WS client on a different board does **not** receive events (both adapter modes)
- [ ] Redis pub/sub routes events across two parallel app nodes (Redis mode only)
- [ ] In-memory adapter works correctly in single-node local dev without Redis running
- [ ] Polling endpoint returns correct events since supplied sequence
- [ ] Presence keys expire after 35 s heartbeat timeout (both adapters)
- [ ] Expired-token WS connection receives `session_expired` and closes
- [ ] Snapshot is written every 50 events; board load uses snapshot + delta
- [ ] `flags.isEnabled('USE_REDIS')` controls adapter selection — no code changes needed to switch modes
- [ ] `docker compose up` (no Redis profile) starts the app and real-time works for a single dev node
