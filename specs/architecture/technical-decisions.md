# Technical Decisions — Collaborative Kanban System

> This document records architecture decisions that were left open in
> [`requirements.md`](./requirements.md) and [`event_sourcing.md`](./event_sourcing.md).
> Every decision includes the rationale and any rejected alternatives.

---

## 1. Runtime & Package Manager

**Decision:** Bun (runtime) + `bun install` (packages)

**Rationale:**
- Native TypeScript execution — no transpile step
- Built-in WebSocket server (`Bun.serve`)
- Fastest cold-start in benchmarks vs Node / Deno
- `Bun.env` keeps env-var access centralised (see `server/config/`)

**Rejected:**
- Node.js — slower startup, requires `ts-node` or build step
- Deno — immature ecosystem for this stack

---

## 2. Database

**Decision:** PostgreSQL 16

**Rationale:**
- ACID transactions required for strong persistence guarantee (§2.1 of requirements)
- JSONB columns for event `payload` and card `metadata` give schema flexibility
- `pg_notify` provides lightweight pub/sub for single-node deployments (replaced by Redis at scale)
- Mature, battle-tested for concurrent writes

**Query builder & migrations:** Knex + `pg` driver
- SQL-first: migrations are plain TypeScript files in `db/migrations/`
- `knex migrate:latest` / `knex migrate:rollback` for migration management
- `knex.schema` builder for table creation; raw SQL available when needed
- No generate step — works natively with Bun
- Full type safety via TypeScript generics

**Rejected:**
- Prisma — requires `prisma generate` step, adds runtime weight; less composable with Bun's module system
- MongoDB — lacks true transactions across collections
- SQLite — not horizontally scalable
- raw `pg` driver only — loses type safety

---

## 3. Event Store

**Decision:** Dedicated `events` table in PostgreSQL (same database)

**Rationale:**
- Requirements (§5.6, §5.7, `event_sourcing.md`) mandate an append-only event log
- A single Postgres table satisfies this at current scale with no extra infrastructure
- `INSERT … RETURNING` provides optimistic locking via `sequence` column
- Migrate to Kafka / EventStoreDB only when replay throughput exceeds ~10k events/s

**Schema additions (not in requirements canonical model):**

```
Event {
  id:         UUID (v7)
  type:       string          -- event type from event_sourcing.md
  board_id:   UUID (indexed)  -- for board-scoped subscriptions
  entity_id:  UUID
  actor_id:   UUID
  payload:    JSONB
  sequence:   bigint (auto-increment, used for ordering & optimistic lock)
  created_at: timestamp
}
```

**Projection snapshots:**

To avoid replaying the full event stream on every board load:
- A `board_snapshots` table stores the materialized board state
- Snapshots are written after every N events (default N = 50)
- On load: fetch latest snapshot + events since snapshot sequence

---

## 4. Real-Time Transport

**Decision:** Bun native WebSocket (`Bun.serve` with `websocket` handler)

**Rationale:**
- Zero extra dependency; Bun's WS is fastest available
- Matches `real_time_sync_protocol.md` transport requirement
- Fallback polling (§5.6) implemented as `/api/boards/:id/poll?since=<sequence>`

**Connection model:**
- Client subscribes to a board room on connect: `{ type: "subscribe", board_id }`
- Server fan-out per board room using in-process `Map<boardId, Set<ServerWebSocket>>`
- For multi-node: Redis pub/sub fan-out (see §5 below)

**Heartbeat:** 30 s ping / 60 s timeout to detect stale connections.

---

## 5. Pub/Sub & Session Scaling

**Production decision:** Redis 7 (pub/sub + rate-limit counters + presence TTLs)

**Rationale:**
- Stateless API horizontal scaling (§6 non-functional) requires shared pub/sub
- Redis pub/sub routes WebSocket events to the correct node
- Redis `INCR` + sliding window for rate limiting (§6 security)
- Redis `SET EX` for presence heartbeats (§5.6, `real_time_sync_protocol.md`)

**Redis is optional in local development.** When the `USE_REDIS` feature flag (see §17) is `false`, the system falls back to in-process adapters:

| Capability | Redis adapter (default) | Local fallback adapter |
|------------|------------------------|------------------------|
| Pub/Sub fan-out | Redis `PUBLISH` / `SUBSCRIBE` | In-process `EventEmitter` (single node only) |
| Presence TTLs | Redis `SET EX` / `DEL` | `node-cache` with TTL |
| Rate-limit counters | Redis Lua sliding window | `node-cache` counters |
| Invite / OAuth nonces | Redis `SET EX` | `node-cache` with TTL |

The pub/sub module exposes a **provider interface** so both adapters are interchangeable:

```ts
// server/mods/pubsub/types.ts
interface PubSubProvider {
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: (msg: string) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
}

// server/mods/cache/types.ts
interface CacheProvider {
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  incr(key: string, ttlSeconds: number): Promise<number>;
}
```

The active adapter is resolved at startup via `server/config/pubsub.ts`:

```ts
// USE_REDIS=false → local EventEmitter + node-cache
// USE_REDIS=true  → ioredis (default in production)
const pubsub: PubSubProvider = flags.USE_REDIS
  ? new RedisPubSubAdapter(env.REDIS_URL)
  : new InMemoryPubSubAdapter();
```

`docker-compose.yml` marks `redis` as an **optional** service with a `profiles: [redis]` tag. Run `docker compose --profile redis up` for the full stack; omit the profile for lightweight local dev.

**Key namespaces (Redis adapter):**

| Purpose | Key pattern |
|---------|-------------|
| Board channel | `board:<boardId>` |
| Presence | `presence:<boardId>:<userId>` TTL 35 s |
| Rate limit | `rl:<userId>:<window>` |
| Invite token | `invite:<token>` TTL configurable |

**Rejected:**
- Kafka — overkill for pub/sub at this scale

---

## 6. Authentication

**Decision:** JWT (RS256) access tokens + opaque refresh tokens stored in httpOnly cookies

**Rationale:**
- Requirements §5.1: tokens expire, rotate, and invalidate immediately on revocation
- RS256 allows stateless verification on any node with the public key
- Refresh tokens stored in `refresh_tokens` table with `revoked_at` column for immediate revocation
- httpOnly cookie prevents XSS access to refresh token

**Token lifetimes:**

| Token | TTL |
|-------|-----|
| Access token (JWT) | 15 minutes |
| Refresh token (opaque) | 7 days |
| OAuth state nonce | 10 minutes |
| Invite token | 48 hours (configurable) |

**OAuth providers:** Google, GitHub (requirements §5.1)
- State nonce stored in Redis with 10-minute TTL
- On callback: upsert `User`, issue refresh token, redirect with access token

**Revocation flow:**
1. DELETE `/auth/logout` — sets `revoked_at` on refresh token
2. All WebSocket connections under that user's session receive `session_expired` event and close

---

## 7. Fractional Indexing

**Decision:** Lexicographic string positions (base62 midpoint algorithm)

**Rationale:**
- Requirements §5.4, §5.5 mandate fractional indexing for deterministic ordering
- Strings never lose precision (vs floats which converge to same value after ~50 inserts)
- On insertion between `"a"` and `"b"`: server generates `"an"` (midpoint)
- On equal collision: server assigns new positions and broadcasts `list_reordered` / `card_moved` event

**Client behavior:** send desired target index (the two neighbours); server resolves and returns authoritative position.

---

## 8. File Storage

**Decision:** AWS S3 in production; LocalStack for local dev — both via `@aws-sdk/client-s3`

**Rationale:**
- Requirements §5.8: signed URL access, transactional upload, virus scanning
- Pre-signed PUT URL flow: client uploads directly to S3 (avoids proxying large files through API)
- On upload complete: client calls `POST /cards/:id/attachments` with S3 key; server records metadata
- LocalStack replaces MinIO — same `@aws-sdk/client-s3` on both sides, only the endpoint URL differs
- LocalStack emulates the S3 API fully including pre-signed URLs, bucket creation, and ACLs

**Storage provider flag:**

| Flag | Value | Effect |
|------|-------|--------|
| `USE_LOCAL_STORAGE` | `true` (default in dev) | S3 endpoint → `http://localstack:4566`, credentials `test`/`test` |
| `USE_LOCAL_STORAGE` | `false` | S3 endpoint from `S3_ENDPOINT` env (blank = native AWS), credentials from `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |

**Virus scanning:**
- Post-upload Lambda / Bun worker invokes ClamAV (self-hosted) or VirusTotal API
- Card attachment marked `status: "pending"` until scan completes
- On fail: attachment marked `status: "rejected"`, client notified via WebSocket event

**Local dev:** LocalStack container in `docker-compose.yml`

```yaml
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      SERVICES: s3
      DEFAULT_REGION: us-east-1
    volumes:
      - localstack_data:/var/lib/localstack
```

---

## 9. API Structure

**Decision:** REST API under `/api/v1/` with the following full resource list

All routes follow the coding conventions in `copilot-instructions.md`:
- HTTP method expresses action
- Single trailing noun segment
- Errors: `{ name: "hyphenated-error-code", data?: any }`
- Success single entity: `{ data: {} }`
- Success array: `{ data: [] }`
- Success paginated: `{ data: [], metadata: { totalPage, perPage } }`

**Full route list (supplements §8 of requirements):**

```
# Auth
POST   /api/v1/auth/token          -- login (email/password), returns access token
POST   /api/v1/auth/refresh        -- rotate refresh token
DELETE /api/v1/auth/session        -- logout (revoke refresh token)
POST   /api/v1/auth/oauth/:provider -- initiate OAuth
GET    /api/v1/auth/oauth/:provider/callback

# Users
GET    /api/v1/users/me
PATCH  /api/v1/users/me
GET    /api/v1/users/:id

# Workspaces
POST   /api/v1/workspaces
GET    /api/v1/workspaces
GET    /api/v1/workspaces/:id
PATCH  /api/v1/workspaces/:id
DELETE /api/v1/workspaces/:id
GET    /api/v1/workspaces/:id/members
POST   /api/v1/workspaces/:id/invite
PATCH  /api/v1/workspaces/:id/members/:userId  -- change role
DELETE /api/v1/workspaces/:id/members/:userId  -- remove member

# Invites
GET    /api/v1/invites/:token       -- inspect invite
POST   /api/v1/invites/:token/accept

# Boards
POST   /api/v1/workspaces/:id/boards
GET    /api/v1/workspaces/:id/boards
GET    /api/v1/boards/:id
PATCH  /api/v1/boards/:id
DELETE /api/v1/boards/:id
POST   /api/v1/boards/:id/duplicate
PATCH  /api/v1/boards/:id/archive

# Lists
POST   /api/v1/boards/:id/lists
GET    /api/v1/boards/:id/lists
PATCH  /api/v1/lists/:id
DELETE /api/v1/lists/:id
PATCH  /api/v1/lists/:id/archive
POST   /api/v1/boards/:id/lists/reorder  -- batch position update

# Cards
POST   /api/v1/lists/:id/cards
GET    /api/v1/cards/:id
PATCH  /api/v1/cards/:id
DELETE /api/v1/cards/:id
PATCH  /api/v1/cards/:id/archive
POST   /api/v1/cards/:id/move           -- move to another list
POST   /api/v1/cards/:id/duplicate

# Card sub-resources
POST   /api/v1/cards/:id/labels
DELETE /api/v1/cards/:id/labels/:labelId
POST   /api/v1/cards/:id/members
DELETE /api/v1/cards/:id/members/:userId
POST   /api/v1/cards/:id/checklist
PATCH  /api/v1/checklist-items/:id
DELETE /api/v1/checklist-items/:id

# Comments
POST   /api/v1/cards/:id/comments
PATCH  /api/v1/comments/:id
DELETE /api/v1/comments/:id

# Attachments
POST   /api/v1/cards/:id/attachments/url        -- external URL
POST   /api/v1/cards/:id/attachments/upload-url -- request S3 pre-signed PUT URL
POST   /api/v1/cards/:id/attachments            -- confirm upload
DELETE /api/v1/attachments/:id

# Activity
GET    /api/v1/cards/:id/activity
GET    /api/v1/boards/:id/activity

# Real-time fallback polling
GET    /api/v1/boards/:id/events?since=<sequence>

# Search
GET    /api/v1/workspaces/:id/search?q=&type=board|card
```

---

## 10. State Management (Frontend)

**Decision:** Redux Toolkit (RTK) + RTK Query for server state

**Rationale:**
- Already established in `sample-project/` (see `src/store.ts`, `src/reducers.ts`)
- RTK Query handles loading/error state, caching, and optimistic updates per requirements §10
- WebSocket events dispatched as Redux actions to update RTK Query cache

**Optimistic update flow:**
1. User action → dispatch optimistic patch to Redux store
2. `PATCH /api/v1/…` sent
3a. Success → confirm patch (no-op or reconcile server response)
3b. Failure → dispatch rollback action, show error toast

---

## 11. Frontend Build

**Decision:** Vite (already in `sample-project/vite.config.ts`)

- HMR in development
- SSR entry via `src/entry-server.tsx` (existing pattern)
- Code splitting per route

---

## 12. Testing Strategy

**Decision:** Bun's built-in test runner (`bun test`)

**Test layers:**

| Layer | Tool | Location |
|-------|------|----------|
| Unit | `bun test` | `*.test.ts` co-located |
| Integration (API) | `bun test` + test DB | `server/**/*.integration.test.ts` |
| E2E | Playwright | `tests/e2e/` |
| Load | `k6` | `tests/load/` |

**Existing test patterns:** see `sample-project/test.ts`

---

## 13. Infrastructure & Deployment

**Decision:** Docker Compose (local) → Kubernetes (production)

**Services (docker-compose.yml):**

```
services:
  app       # Bun server
  postgres  # PostgreSQL 16
  redis     # Redis 7
  minio     # S3-compatible local storage
  clamav    # Virus scanning (optional, toggled by env var)
```

**Environment config:** centralised in `server/config/env.ts` (existing pattern)  
No direct `process.env` access outside that file.

---

## 14. Observability

**Decision:** OpenTelemetry (OTEL) SDK

**Rationale:**
- Requirements §12: mutation latency, sync delay, error rates, conflict rate, WS disconnects
- OTEL is vendor-neutral; export to Grafana/Datadog/Honeycomb without code changes

**Instrumentation points:**
- HTTP request duration (middleware)
- WebSocket event fan-out latency
- DB query duration (Prisma middleware)
- Event sequence gaps (conflict detection)

---

## 15. CSRF Protection

**Decision:** `SameSite=Strict` cookie for refresh token + `X-Requested-With` header check for state-mutating API calls

**Rationale:**
- `SameSite=Strict` prevents cross-origin cookie submission
- Stateless API (no session cookie on access token path) reduces CSRF surface
- Access token sent in `Authorization: Bearer` header — not a cookie — so no CSRF vector there

---

## 16. Rate Limiting

**Decision:** Redis sliding-window counter per `userId` + `IP`

**Limits:**

| Endpoint class | Limit |
|----------------|-------|
| Auth (login, refresh) | 10 req / minute |
| Mutations (POST, PATCH, DELETE) | 120 req / minute |
| Reads (GET) | 600 req / minute |
| File upload initiation | 20 req / minute |

Exceeded limit returns `HTTP 429` with `Retry-After` header.

---

## 17. Feature Flags

**Decision:** Multi-source feature flag system with a provider abstraction — supports remote providers (Flagsmith, FeatBit) and local sources (environment variables, JSON file) behind the same interface.

### Rationale

- Feature flags must be available from **day 1** to gate infrastructure choices (e.g., `USE_REDIS`, `VIRUS_SCAN_ENABLED`) without hardcoding
- Remote providers (Flagsmith / FeatBit) give per-user/per-workspace targeting in production
- ENV + JSON file sources require zero infrastructure — usable in CI, tests, and bare local dev
- A single `flags` object imported everywhere ensures no ad-hoc `Bun.env` checks scattered across the codebase

### Provider Interface

```ts
// server/mods/flags/types.ts
interface FlagProvider {
  /** Return the resolved boolean value of a flag for an optional context */
  isEnabled(flagKey: string, context?: FlagContext): Promise<boolean>;
  /** Return a typed variant value (string | number | json) */
  getValue<T>(flagKey: string, defaultValue: T, context?: FlagContext): Promise<T>;
  /** Batch-load and cache all flags (call once at startup) */
  load(): Promise<void>;
}

interface FlagContext {
  userId?: string;
  workspaceId?: string;
  email?: string;
}
```

### Source Hierarchy (lowest → highest priority)

```
1. Hardcoded defaults (in code)
2. JSON file (path from Bun.env.FEATURE_FLAGS_JSON_PATH)
3. Environment variables  (FLAG_<KEY>=true|false)
4. Remote provider        (Flagsmith / FeatBit, if FEATURE_FLAGS_PROVIDER is set)
```

Higher-priority sources override lower ones. If the remote provider is unreachable, the system falls back to next available source and logs a warning (no crash).

### Configuration

```ts
// server/config/flags.ts  — single entry point, all flag config here
export const flagsConfig = {
  provider: env.FEATURE_FLAGS_PROVIDER,   // "flagsmith" | "featbit" | "local" | undefined
  flagsmithKey:  env.FLAGSMITH_SERVER_KEY,
  featbitSdkKey: env.FEATBIT_SDK_KEY,
  featbitUrl:    env.FEATBIT_URL,
  jsonPath:      env.FEATURE_FLAGS_JSON_PATH,  // e.g. "/config/flags.json"
};
```

### Module Structure

```
server/mods/flags/
  types.ts            # FlagProvider interface + FlagContext
  index.ts            # resolves active providers, exports singleton `flags` object
  providers/
    env.ts            # reads FLAG_<KEY>=true|false from Bun.env
    json.ts           # parses JSON file at FEATURE_FLAGS_JSON_PATH
    flagsmith.ts      # Flagsmith Node.js SDK wrapper
    featbit.ts        # FeatBit server SDK wrapper
    composite.ts      # merges sources in priority order
  defaults.ts         # hardcoded fallback values for every known flag
```

### Known Platform Flags

| Flag key | Default | Purpose |
|----------|---------|--------|
| `USE_REDIS` | `true` | Enable Redis adapter; `false` uses in-process fallbacks |
| `VIRUS_SCAN_ENABLED` | `true` | Run ClamAV scan on attachments |
| `OAUTH_GOOGLE_ENABLED` | `true` | Allow Google OAuth login |
| `OAUTH_GITHUB_ENABLED` | `true` | Allow GitHub OAuth login |
| `SEARCH_ENABLED` | `true` | Expose search endpoint (sprint 12) |
| `RATE_LIMIT_ENABLED` | `true` | Enforce rate limits (sprint 13) |
| `OTEL_ENABLED` | `true` | Emit OTEL traces/metrics (sprint 13) |
| `BOARD_SNAPSHOT_ENABLED` | `true` | Use board snapshots for fast load (sprint 08) |

### Usage Pattern

```ts
// Any server file
import { flags } from '../mods/flags';

const useRedis = await flags.isEnabled('USE_REDIS');
// → checks env FLAG_USE_REDIS, then JSON file, then remote provider
```

### ENV Flag Format

```dotenv
# .env
FLAG_USE_REDIS=false
FLAG_VIRUS_SCAN_ENABLED=false
FLAG_OAUTH_GITHUB_ENABLED=true
```

### JSON File Format

```json
{
  "USE_REDIS": false,
  "VIRUS_SCAN_ENABLED": false,
  "BOARD_SNAPSHOT_ENABLED": true
}
```

Path set via `FEATURE_FLAGS_JSON_PATH=/config/flags.json`. File is hot-reloaded every 30 s in development.

### Frontend Feature Flags

Client-side flags are served via a single endpoint:

```
GET /api/v1/flags
→ { data: { [flagKey]: boolean | string | number } }
```

Only flags explicitly allow-listed for client exposure are returned (server controls the list). Never expose secret keys or internal flags.

### Remote Provider Notes

- **Flagsmith:** use the server-side Node SDK (`flagsmith-nodejs`), poll interval 60 s
- **FeatBit:** use the FeatBit server SDK, streaming updates
- Both providers are optional — the system operates fully without them using ENV/JSON sources
- SDK initialisation failure on startup: log warning, continue with local sources only
