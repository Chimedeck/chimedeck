# Architecture — Collaborative Kanban System

> Synthesized from [`requirements.md`](./requirements.md), [`technical-decisions.md`](./technical-decisions.md),
> [`event_sourcing.md`](./event_sourcing.md), and [`real_time_sync_protocol.md`](./real_time_sync_protocol.md).
> This document is the single authoritative reference for implementation agents.

---

## 1. System Overview & Goals

A multi-tenant, real-time collaborative Kanban board platform.

**Core guarantees (from requirements §2):**

- Strong persistence — no acknowledged write is lost
- Deterministic concurrency — all clients converge to identical board state
- Event immutability — activity log is append-only
- Permission correctness — server is the source of truth
- Eventual real-time consistency — clients converge within 1 second
- UI rollback safety — failed optimistic updates revert cleanly

---

## 2. Domain Model

```
Workspace
  └── Board (active | archived | deleted)
        └── List (fractional-index ordered)
              └── Card (fractional-index ordered)
                    ├── Labels       (workspace-scoped, max 20 per card)
                    ├── CardMembers  (user assignments)
                    ├── ChecklistItems (max 100 per card)
                    └── Attachments  (S3 / external URL)

User
  └── Membership → Workspace  (role: Owner | Admin | Member | Viewer)

Event
  └── board_id, type, payload, sequence (append-only)

BoardSnapshot
  └── board_id, state JSONB, since_sequence
```

All entity IDs: CUID2 (sortable). Positions: lexicographic base-62 fractional index.

---

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.2 — native TS, hot-reload via `--hot` |
| HTTP / WS | `Bun.serve` — built-in WebSocket, no extra deps |
| Database | PostgreSQL 16 + Prisma ORM |
| Migrations | Prisma `prisma migrate dev` — named `000N_<description>` |
| Cache / Pub-Sub | Redis 7 (prod) **or** `node-cache` + `EventEmitter` (local dev) |
| File storage | S3-compatible (MinIO locally, any S3 in prod) |
| Frontend build | Vite (SSR-compatible) |
| State management | Redux Toolkit + RTK Query |
| Feature flags | Composite: defaults → JSON file → ENV vars → Remote (Flagsmith/FeatBit) |
| Auth | JWT RS256 (15 min) + opaque refresh tokens in httpOnly cookies (7 days) |
| Testing | `bun test` (unit/integration), Playwright (E2E), k6 (load) |
| Observability | OpenTelemetry — vendor-neutral OTLP export |
| Containerisation | Multi-stage Docker (`oven/bun:1.2-alpine`), non-root `app` user |

---

## 4. Server Folder Structure

```
server/
  index.ts                   # entry point — Bun.serve()
  config/
    env.ts                   # all Bun.env vars exposed here (never process.env elsewhere)
    pubsub.ts                # resolves PubSubProvider from USE_REDIS flag
    cache.ts                 # resolves CacheProvider from USE_REDIS flag
    jwt.ts                   # RS256 key loading
  extensions/
    auth/                    # Sprint 03 — login, register, logout, OAuth
    workspace/               # Sprint 04 — workspace CRUD, invites, RBAC
    board/                   # Sprint 05 — board lifecycle
    list/                    # Sprint 06 — list CRUD + reorder
    card/                    # Sprint 07 — card CRUD + move
    label/                   # Sprint 08 — labels, card-members, checklists
    events/                  # Sprint 09 — event store writes + WS fan-out
    comments/                # Sprint 11 — comments + activity
    attachment/              # Sprint 12 — file upload, S3, virus scan
    search/                  # Sprint 13 — full-text search
  mods/
    flags/                   # Sprint 01 — composite feature flag provider
      index.ts               # getFlag(key, context?) → boolean | string | number
      providers/
        defaults.ts
        envProvider.ts
        jsonFileProvider.ts
        remoteProvider.ts    # Flagsmith / FeatBit (non-fatal on failure)
    pubsub/
      types.ts               # PubSubProvider interface
      redis.ts               # ioredis adapter
      inMemory.ts            # EventEmitter adapter
    cache/
      types.ts               # CacheProvider interface
      redis.ts               # ioredis adapter
      nodeCache.ts           # node-cache adapter
    permissions/             # RBAC middleware
    response/                # standard { data, includes, metadata } shape
    schemas/                 # Zod validation schemas
    jwt/                     # sign / verify helpers
    websocket/               # WS connection registry + board room fan-out
  middlewares/
    auth.ts                  # JWT verification
    permissions.ts           # RBAC role check
    dataValidator.ts         # Zod body/query validation
  prisma/
    schema.prisma
    migrations/
```

---

## 5. Client Folder Structure

```
src/
  extensions/
    Auth/                    # Sprint 03 — login/register pages, auth duck
    Workspace/               # Sprint 04 — workspace pages
    Board/                   # Sprint 05 — board view
    List/                    # Sprint 06 — list column component
    Card/                    # Sprint 07/08 — card modal, checklist, labels
    Realtime/                # Sprint 10 — WS hook, optimistic update, rollback
    Comments/                # Sprint 11 — comment thread
    Attachments/             # Sprint 12 — file upload UI
    Search/                  # Sprint 13 — search overlay
  store.ts                   # Redux store
  reducers.ts                # root reducer
```

---

## 6. API Conventions

- Base path: `/api/v1/`
- HTTP methods per [copilot-instructions.md](../../.github/copilot-instructions.md): GET / POST / PUT / PATCH / DELETE — no action verbs in URL
- Responses: `{ data: T }` (single), `{ data: T[] }` (array), `{ data: T[], metadata: { totalPage, cursor } }` (paginated)
- Errors: `{ name: "hyphen-separated-slug", data?: any }` + appropriate HTTP status
- Auth header: `Authorization: Bearer <access_token>`
- Refresh token: httpOnly `__refresh_token` cookie

---

## 7. Real-Time Protocol (summary)

Full spec: [`real_time_sync_protocol.md`](./real_time_sync_protocol.md)

- Client connects WS and sends `{ type: "subscribe", board_id }`
- Server broadcasts `{ type: "event", payload: Event }` to all subscribers of that board
- Client applies event to local Redux state (optimistic update already applied)
- Conflict: last-writer-wins on scalar fields, CRDT merge on positions
- Fallback: HTTP polling `/api/boards/:id/poll?since=<sequence>` for clients that cannot hold WS

---

## 8. Event Sourcing (summary)

Full spec: [`event_sourcing.md`](./event_sourcing.md)

- Every mutation appends one or more `Event` rows to the `events` table
- `Event.sequence` is a bigint auto-increment used for ordering and optimistic locking
- Board snapshots written every 50 events to avoid full replay on load
- Event types defined in `event_sourcing.md` §3 — examples: `card.created`, `card.moved`, `list.reordered`

---

## 9. Feature Flags

Full spec: [`technical-decisions.md §17`](./technical-decisions.md)

Priority order (highest wins):
1. Remote provider (Flagsmith / FeatBit) — non-fatal on network failure
2. ENV vars `FLAG_<KEY>=true|false`
3. JSON file at `FEATURE_FLAGS_JSON_PATH`
4. Hardcoded defaults in `server/mods/flags/providers/defaults.ts`

All server code accesses flags via `import { getFlag } from 'server/mods/flags'` — never raw `Bun.env`.

---

## 10. Security Model

- Deny-first: every route requires authenticated user unless explicitly public
- RBAC checked server-side on every mutation; client role state is advisory only
- Refresh tokens stored in DB with `revoked_at`; immediate invalidation on logout
- CSRF: SameSite=Strict cookie + `X-Requested-With` header check on mutations
- Secrets never in source — all via `.env` (gitignored); `.env.example` committed
- Rate limiting via Redis sliding window (or `node-cache` in dev) — per-user per-endpoint

---

## 11. Deployment

- **Dev:** `docker compose up` — postgres + minio + app (hot-reload); add `--profile redis` for Redis
- **Prod:** `docker compose -f docker-compose.prod.yml up` — 2 replicas, rolling update, non-root `app` user
- **CI:** GitHub Actions — typecheck → lint → unit tests → docker build (with layer cache) → E2E

---

## 12. Open Questions (resolved)

All questions from `requirements.md` §15 have been addressed in `technical-decisions.md`.
No blocking unknowns remain before sprint implementation begins.
