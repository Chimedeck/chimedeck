# Sprint 01 — Project Setup & Infrastructure

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §6](../architecture/requirements.md), [technical-decisions.md](../architecture/technical-decisions.md)

---

## Goal

Establish the full local development environment and skeleton so every subsequent sprint can start coding immediately.

No user-visible features are shipped in this sprint. All infrastructure decisions are codified here per [technical-decisions.md §§1-3, 13, 17](../architecture/technical-decisions.md). Feature flags infrastructure is a **day-1 deliverable** — every subsequent sprint imports from `server/mods/flags/`.

---

## Scope

### 1. Runtime & Repository

- Bun as runtime (`#!/usr/bin/env bun`) — [technical-decisions.md §1](../architecture/technical-decisions.md)
- `package.json` with `bun install` scripts
- TypeScript strict mode (`tsconfig.json`)
- ESLint + Prettier config

### 2. Docker Compose

Per [technical-decisions.md §§5, 13](../architecture/technical-decisions.md) — Redis is optional in local dev:

```yaml
services:
  app       # Bun server (hot-reload in dev)
  postgres  # PostgreSQL 16
  minio     # S3-compatible local file storage
  redis     # Redis 7 — optional, enable with: docker compose --profile redis up
    profiles: [redis]
```

- `postgres` healthcheck gates `app` startup
- `redis` is gated by the `redis` profile; when absent the app boots with `FLAG_USE_REDIS=false`
- `.env.example` documents both modes clearly

### 3. Environment Configuration

- `server/config/env.ts` — single file exposing all `Bun.env` vars
- `.env.example` committed; `.env` gitignored
- Required vars: `DATABASE_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `S3_*`, `APP_PORT`
- Optional vars: `REDIS_URL` (omit to run without Redis), `FEATURE_FLAGS_PROVIDER`, `FLAGSMITH_SERVER_KEY`, `FEATBIT_SDK_KEY`, `FEATBIT_URL`, `FEATURE_FLAGS_JSON_PATH`
- Flag overrides via env: `FLAG_USE_REDIS=false`, `FLAG_VIRUS_SCAN_ENABLED=false`, etc. (see [technical-decisions.md §17](../architecture/technical-decisions.md))

### 4. Database & Prisma

- Prisma initialised with PostgreSQL provider
- Baseline schema: empty `schema.prisma` with `datasource` + `generator`
- First migration: `0001_init` (empty — establishes migration history)
- `bun run db:migrate` script
- `bun run db:studio` script (Prisma Studio)

### 5. HTTP Server Skeleton

Using `Bun.serve` (per [technical-decisions.md §4](../architecture/technical-decisions.md)):

```
server/
  index.ts           # entry point: Bun.serve
  config/
    env.ts
    app.ts
  mods/
    logger.ts        # request logging
    helmet.ts        # security headers
  middlewares/
    parser/          # JSON body parser
```

All routes return `{ data: null }` placeholder; no business logic yet.

### 6. CI Skeleton

GitHub Actions workflow:
- `bun install`
- `bun run lint`
- `bun test`
- `docker compose build`

### 7. OpenAPI Skeleton

`server/mods/openapi/` — registers routes for documentation (per existing `sample-project` pattern).

### 8. Feature Flags Infrastructure

Per [technical-decisions.md §17](../architecture/technical-decisions.md):

```
server/mods/flags/
  types.ts            # FlagProvider interface + FlagContext
  index.ts            # resolves providers, exports singleton `flags`
  defaults.ts         # hardcoded fallback values for all known flags
  providers/
    env.ts            # reads FLAG_<KEY>=true|false from Bun.env
    json.ts           # parses JSON file at FEATURE_FLAGS_JSON_PATH
    flagsmith.ts      # Flagsmith Node.js SDK (no-op if key absent)
    featbit.ts        # FeatBit server SDK (no-op if key absent)
    composite.ts      # merges sources: defaults → json → env → remote

server/config/flags.ts   # wires Bun.env vars into flagsConfig, called by flags/index.ts
```

**Startup sequence:**
1. `flags/index.ts` calls `composite.load()` — initialises all configured providers
2. Remote provider failure → warning log, fallback to env/json sources
3. `flags` singleton is available synchronously via cached values after `load()`

**Frontend flags endpoint (stub):**

```
GET /api/v1/flags  →  { data: {} }   (empty in sprint 01; populated as flags are allow-listed)
```

**`node-cache` dependency** added to `package.json` in this sprint so sprint 08 can use it as the local cache/pubsub fallback. No Redis dependency required at this stage.

---

## Files Affected

```
docker-compose.yml
.env.example
package.json
tsconfig.json
.eslintrc
server/index.ts
server/config/env.ts
server/config/app.ts
server/config/flags.ts
server/mods/logger.ts
server/mods/helmet.ts
server/mods/flags/         # feature flags module
server/middlewares/parser/
prisma/schema.prisma
prisma/migrations/0001_init/
.github/workflows/ci.yml
```

---

## Acceptance Criteria

- [ ] `docker compose up` starts postgres + minio + app with no errors (no Redis required)
- [ ] `docker compose --profile redis up` adds Redis service cleanly
- [ ] `curl http://localhost:3000/health` returns `{ "status": "ok" }`
- [ ] `bun run db:migrate` runs without error
- [ ] `bun test` passes (zero tests, zero failures)
- [ ] `bun run lint` passes
- [ ] All env vars documented in `.env.example`
- [ ] No `process.env` access outside `server/config/env.ts`
- [ ] `flags.isEnabled('USE_REDIS')` returns `false` when `FLAG_USE_REDIS=false` is set
- [ ] `flags.isEnabled('USE_REDIS')` returns value from JSON file when `FEATURE_FLAGS_JSON_PATH` points to a file with `{ "USE_REDIS": false }`
- [ ] Remote provider unreachable → app boots without crash, falls back to env/json sources
- [ ] `GET /api/v1/flags` returns `{ data: {} }` (empty stub)
