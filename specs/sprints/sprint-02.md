# Sprint 02 — Build Tooling & Docker

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [technical-decisions.md §§1, 13](../architecture/technical-decisions.md)  
> **Depends on:** [sprint-01.md](./sprint-01.md)

---

## Goal

Deliver a complete, reproducible development and production build pipeline before any application code is written. Every developer on the team — and every CI/CD runner — must be able to:

1. Start a fully wired local environment with a single command
2. Produce a production-ready Docker image with a single command
3. Run all quality checks (lint, typecheck, test) with a single command

All subsequent sprints rely on this foundation without touching build config again.

---

## Scope

### 1. `package.json` Scripts

All scripts use `bun` as the runtime per [technical-decisions.md §1](../architecture/technical-decisions.md). No `npm run` or `yarn` equivalents.

```jsonc
{
  "scripts": {
    // ── Development ──────────────────────────────
    "dev":            "bun run --hot server/index.ts",
    "dev:client":     "vite",
    "dev:full":       "concurrently \"bun run dev\" \"bun run dev:client\"",

    // ── Build (production) ───────────────────────────────
    "build":          "bun run build:client && bun run build:server",
    "build:client":   "vite build",
    "build:server":   "bun run typecheck",        // Bun runs TS directly — no transpile

    // ── Start (production) ───────────────────────
    "start":          "NODE_ENV=production bun run server/index.ts",

    // ── Database —————————————————————————————
    "db:migrate":     "knex migrate:latest",
    "db:rollback":    "knex migrate:rollback",
    "db:seed":        "bun run db/seeds/run.ts",

    // ── Quality ──────────────────────────────────
    "lint":           "eslint . --ext .ts,.tsx",
    "lint:fix":       "eslint . --ext .ts,.tsx --fix",
    "format":         "prettier --write .",
    "format:check":   "prettier --check .",
    "typecheck":      "tsc --noEmit",
    "typecheck:watch":"tsc --noEmit --watch",

    // ── Testing ──────────────────────────────────
    "test":           "bun test",
    "test:watch":     "bun test --watch",
    "test:coverage":  "bun test --coverage",
    "test:e2e":       "playwright test",
    "test:load":      "k6 run tests/load/board-load.js",

    // ── Docker convenience wrappers ───────────────
    "docker:dev":     "docker compose -f docker-compose.yml up --build",
    "docker:dev:redis":"docker compose -f docker-compose.yml --profile redis up --build",
    "docker:prod":    "docker compose -f docker-compose.prod.yml up",
    "docker:build":   "docker build -t kanban-app:latest .",
    "docker:build:nc":"docker build --no-cache -t kanban-app:latest .",

    // ── Utilities ────────────────────────────────
    "clean":          "rm -rf dist .vite node_modules/.cache",
    "prepare":        "bun run db:generate"
  }
}
```

**`concurrently`** is the only dev-dependency added in this sprint for `dev:full`.

### 2. Production Dockerfile (Multi-Stage)

Extends the pattern from `sample-project/Dockerfile` (read-only reference) to add:
- Non-root runtime user
- Layer caching optimised for `bun.lockb` + `package.json` before source copy
- No generate step needed (Knex has no code generation)

```dockerfile
# ── Stage 1: Install all dependencies ──────────────────────────
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build frontend (Vite) + generate Prisma client ────
FROM deps AS build
WORKDIR /app

COPY . .
RUN bun run build:client          # → dist/
RUN bunx prisma generate          # → node_modules/.prisma/

# ── Stage 3: Production runtime (minimal image) ────────────────
FROM oven/bun:1.2-alpine AS production
WORKDIR /app

# Security: non-root user
RUN addgroup --system app && adduser --system --ingroup app app

# Copy only what production needs
COPY --from=build /app/dist                     ./dist
COPY --from=build /app/node_modules             ./node_modules
COPY --from=build /app/package.json             ./package.json
COPY --from=build /app/prisma                   ./prisma
COPY --from=build /app/server                   ./server
COPY --from=build /app/tsconfig.json            ./tsconfig.json

USER app

ARG PORT=3000
ENV PORT=$PORT
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1

CMD ["bun", "run", "start"]
```

**File location:** `Dockerfile` at repo root (same level as `package.json`).

### 3. Development-Specific Dockerfile

```dockerfile
# Dockerfile.dev — used only by docker-compose.yml
FROM oven/bun:1.2-alpine
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

# Mount source as a volume — no COPY of src
# Hot-reload via bun --hot

ARG PORT=3000
ENV PORT=$PORT
EXPOSE $PORT

CMD ["bun", "run", "--hot", "server/index.ts"]
```

**File location:** `Dockerfile.dev`

### 4. Docker Compose — Development

`docker-compose.yml` (used by `bun run docker:dev`):

```yaml
name: kanban-dev

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "${APP_PORT:-3000}:3000"
    env_file: .env
    volumes:
      - .:/app
      - /app/node_modules         # preserve container node_modules
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kanban
      POSTGRES_PASSWORD: kanban
      POSTGRES_DB: kanban_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kanban"]
      interval: 5s
      timeout: 5s
      retries: 10

  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      SERVICES: s3
      DEFAULT_REGION: us-east-1
    volumes:
      - localstack_data:/var/lib/localstack

  redis:
    image: redis:7-alpine
    profiles: [redis]         # optional — only started with --profile redis
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  localstack_data:
```

### 5. Docker Compose — Production

`docker-compose.prod.yml` (used in CI/CD deploy):

```yaml
name: kanban-prod

services:
  app:
    image: "${DOCKER_IMAGE:-kanban-app}:${IMAGE_TAG:-latest}"
    ports:
      - "${APP_PORT:-3000}:3000"
    env_file: .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: always
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s

  postgres:
    image: postgres:16-alpine
    env_file: .env.production
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

> In production, Redis is always on — the `USE_REDIS` flag defaults to `true`.

### 6. `.env.example` Additions

Add entries so every developer knows which scripts map to which vars:

```dotenv
# === Docker / Build ===
APP_PORT=3000
NODE_ENV=development

# === Docker production image ===
DOCKER_IMAGE=kanban-app
IMAGE_TAG=latest
```

### 7. CI Pipeline Update

Extend `.github/workflows/ci.yml` from sprint 01:

```yaml
jobs:
  quality:
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run format:check
      - run: bun run typecheck
      - run: bun test

  docker-build:
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build production image
        uses: docker/build-push-action@v5
        with:
          context: .
          dockerfile: Dockerfile
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
          tags: kanban-app:ci
```

GitHub Actions cache (`type=gha`) speeds up layer reuse between CI runs.

### 8. Makefile (Optional Convenience)

`Makefile` at repo root — wraps common `bun run` commands for developers who prefer `make`:

```makefile
.PHONY: dev build test clean docker

dev:
	bun run docker:dev

dev-redis:
	bun run docker:dev:redis

build:
	bun run build

test:
	bun run test

lint:
	bun run lint

typecheck:
	bun run typecheck

docker:
	bun run docker:build

clean:
	bun run clean
```

---

## Files Affected

```
Dockerfile                  # production multi-stage
Dockerfile.dev              # dev hot-reload image
docker-compose.yml          # updated from sprint 01 skeleton
docker-compose.prod.yml     # new production compose
package.json                # full scripts section
Makefile                    # optional convenience wrappers
.env.example                # Docker / build vars appended
.github/workflows/ci.yml    # docker-build job added
```

---

## Acceptance Criteria

- [ ] `bun run dev` starts the server with hot-reload
- [ ] `bun run build` produces `dist/` with Vite-built client assets
- [ ] `bun run typecheck` returns zero errors on the sprint-01 codebase
- [ ] `bun run test` passes
- [ ] `bun run lint` passes
- [ ] `docker build -f Dockerfile -t kanban-app:test .` succeeds
- [ ] `docker run --env-file .env kanban-app:test` starts and `/health` responds
- [ ] `bun run docker:dev` starts postgres + localstack + app without Redis (no error)
- [ ] `bun run docker:dev:redis` starts the Redis service in addition
- [ ] CI workflow runs `quality` + `docker-build` jobs on every push
- [ ] `docker-compose.prod.yml` references no hardcoded secrets (all from `env_file`)
- [ ] Production image runs as non-root user `app`
- [ ] Image layer cache is reused on second `docker build` (bun.lockb layer not rebuilt if unchanged)
