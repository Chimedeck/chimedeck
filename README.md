# HoriFlow

A real-time collaborative board platform built with Bun, PostgreSQL, and WebSockets.  
This repo also contains the agent loop that builds it sprint by sprint.

## Application Setup

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0
- Docker + Docker Compose

### Quick start (local dev — no Redis required)

```bash
# 1. Install dependencies
bun install

# 2. Copy environment config and edit as needed
cp .env.example .env

# 3. Build + start Postgres (pg_cron image built on first run, ~20 s) + LocalStack S3
docker compose up -d postgres localstack

# 4. Run database migrations
bun run db:migrate

# Optionally, when you have the seeds file to test
# Put this files in db/all_trello_cards.json
bun run db:seed:trello 

# 5. Start the dev server (hot-reload)
bun run dev:full
```

> `curl http://localhost:3000/health` → `{ "status": "ok" }`

### With Redis (full stack)

```bash
docker compose --profile redis up -d
```

Set `FLAG_USE_REDIS=true` (or remove the flag) in `.env` to enable the Redis adapter.

### Feature Flags

Feature flags are resolved from multiple sources (lowest → highest priority):

1. Hardcoded defaults (`server/mods/flags/defaults.ts`)
2. JSON file (`FEATURE_FLAGS_JSON_PATH=/config/flags.json`)
3. Environment variables (`FLAG_<KEY>=true|false`)
4. Remote provider (Flagsmith / FeatBit — configured via `FEATURE_FLAGS_PROVIDER`)

```bash
# Run without Redis
FLAG_USE_REDIS=false bun run dev

# Run without virus scanning
FLAG_VIRUS_SCAN_ENABLED=false bun run dev

# Use Bun Worker scheduler instead of pg_cron (default for local dev)
AUTOMATION_USE_PGCRON=false bun run dev
```

### Available scripts

| Command | Description |
|---|---|
| `bun run dev` | Start with hot-reload |
| `bun run start` | Start production server |
| `bun run build` | Build client (Vite) + typecheck server |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run db:migrate` | Run database migrations |
| `bun run db:seed:trello` | Seed database from Trello export |
| `bun test` | Run all tests |
| `bun run docker:build` | Build the production Docker image |
| `bun run docker:prod` | Run the production image via docker-compose |

### Running production mode locally

**Option A — native Bun (no Docker):**

```bash
# Build Vite client bundle + typecheck
bun run build

# Start server in production mode
bun run start
```

**Option B — Docker (closest to real production):**

```bash
# Build the production image (multi-stage: deps → build → runtime)
bun run docker:build

# Run with the prod compose file (uses .env for config)
bun run docker:prod
```

> Make sure `.env` contains all required variables (see `.env.example`) before running either option.

---

## Production Build & Deployment

The production image is a single self-contained Docker container (Vite client bundle + Bun server). External services — Postgres (RDS) and S3 — are referenced by URL via environment variables; nothing is co-located with the app container.

### What the Docker build does

1. **Stage 1 — deps**: `bun install --frozen-lockfile`
2. **Stage 2 — build**: `vite build` (client bundle → `dist/`) + `tsc --noEmit` (typecheck)
3. **Stage 3 — runtime**: copies `node_modules`, `server/`, `db/`, `dist/`, and `entrypoint.sh` into a minimal Alpine image; runs as a non-root user

### CI pipeline (build & push to ECR)

```bash
# Authenticate to ECR
aws ecr get-login-password --region <region> \
  | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com

# Build — typecheck + Vite bundle happen inside the multi-stage Dockerfile
docker build -t horiflow-app:${IMAGE_TAG} .

# Tag and push
docker tag horiflow-app:${IMAGE_TAG} <account>.dkr.ecr.<region>.amazonaws.com/horiflow-app:${IMAGE_TAG}
docker push <account>.dkr.ecr.<region>.amazonaws.com/horiflow-app:${IMAGE_TAG}
```

### CD pipeline (host machine)

The host only needs two files — **no source code required**:

| File | How it gets there |
|---|---|
| `docker-compose.prod.yml` | `scp`'d once, or kept in a separate deploy repo |
| `.env.production` | Created manually on the host (contains secrets — never commit this) |

`docker-compose.prod.yml` references the ECR image by name/tag via `image: "${DOCKER_IMAGE}:${IMAGE_TAG}"`. Compose pulls it from ECR and starts it — no build step on the host.

```bash
# 1. Authenticate to ECR
aws ecr get-login-password --region <region> \
  | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com

# 2. Run database migrations (one-off container — Compose pulls the image here)
docker run --rm --env-file .env.production \
  <account>.dkr.ecr.<region>.amazonaws.com/horiflow-app:${IMAGE_TAG} \
  bun run db:migrate

# 3. (One-time, local-db profile only) Activate pg_cron after the first migration
#    Skip this step when using external RDS — configure pg_cron there separately.
docker compose -f docker-compose.prod.yml --profile local-db exec postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_cron;" \
  -c "SELECT cron.schedule('automation-tick','* * * * *',\$\$SELECT automation_scheduler_tick()\$\$);"

# 4. Start the app (Compose reuses the already-pulled image)
#
# Default — external RDS + S3 (AWS managed):
DOCKER_IMAGE=<account>.dkr.ecr.<region>.amazonaws.com/horiflow-app \
IMAGE_TAG=${IMAGE_TAG} \
docker compose -f docker-compose.prod.yml up -d

# With internal Postgres instead of RDS (builds Dockerfile.postgres on first run, ~20 s):
docker compose -f docker-compose.prod.yml --profile local-db up -d

# With LocalStack instead of AWS S3:
docker compose -f docker-compose.prod.yml --profile local-s3 up -d

# With Redis sidecar:
docker compose -f docker-compose.prod.yml --profile redis up -d

# Combining profiles:
docker compose -f docker-compose.prod.yml --profile local-db --profile local-s3 --profile redis up -d
```

> The app connects to **AWS RDS** via `DATABASE_URL` and to **AWS S3** via `S3_BUCKET` / `AWS_*` credentials — no database or S3 container runs on the host.

### Environment

Copy `.env.example` to `.env.production` on the host and fill in all values.

```bash
cp .env.example .env.production
```

Key production-only variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full Postgres connection string (e.g. RDS endpoint) |
| `S3_BUCKET` | AWS S3 bucket name |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials for S3 |
| `AWS_REGION` | AWS region |

### Feature flags at startup

| Variable | Default | Effect |
|---|---|---|
| `SEED_TRELLO` | `false` | Runs `bun run db:seed:trello` before the server starts |
| `AUTOMATION_USE_PGCRON` | `false` | `true` enables pg_cron scheduling; `false` uses Bun Worker (setInterval) fallback — the fallback does not survive restarts so use `true` in production |

Set `SEED_TRELLO=true` in `.env.production` for the first deployment to import Trello data, then set it back to `false`.

---

## Agent Loop (Agentic Boilerplate)

A GitHub Copilot agent loop for building Sharetribe Horizon extensions iteratively.
Each run cycles through **Recap → Planning → Execute → Retest → Changelog** with mandatory test creation for new flows and changelog documentation for all edits.

---

## Prerequisites

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) installed and authenticated (`gh copilot --version`)
- Git with SSH access to the JourneyHorizon GitHub org
- `bash` 4+

---

## Getting Started

### Step 1 — Fill in your project requirements

Open [`specs/architecture/requirements.md`](specs/architecture/requirements.md) and replace every `(fill in)` placeholder with real content:

- **Project Name** — what the project is called
- **Description** — what it does and who it's for
- **Key Features** — the main features to build, one per line
- **External Integrations** — third-party services (Stripe, Voucherify, etc.)
- **Constraints** — non-negotiables (tech stack, legal, performance, timeline)
- **Open Questions** — anything the architect should flag before writing code

This file is the agent's primary source of intent. The more detail you provide, the better the generated architecture will be.

> ⚠️ `setup.sh` will refuse to run until all `(fill in)` placeholders have been replaced.

### Step 2 — Run setup (once only)

```bash
bash setup.sh
```

This validates your requirements file, then clones the Sharetribe web template into `./sample-project/` as a **read-only reference repository**.  
The agent will consult it during every Recap and Planning phase to understand upstream patterns — it is never modified.

> ⚠️ Only run `setup.sh` once. Re-running it is safe (the clone step is skipped if the directory already exists), but there is no reason to run it again after the initial setup.

### Step 3 — Run the agent loop

```bash
bash start-agent-loop.sh "Your task description here"
```

Write a clear, one-sentence task description as the first argument.

Example:

```bash
bash start-agent-loop.sh "Implement the Voucher discount feature with Voucherify integration"
```

The loop runs up to **10 iterations** by default. Each iteration:

| Phase | Model | What happens |
|---|---|---|
| **Recap** | Claude Haiku 4.5 | Reads specs, changelogs, and the reference repo; summarises current state |
| **Planning** | Claude Sonnet 4.6 | Produces a scoped, numbered implementation plan (≤ 2 features per iter) |
| **Execute** | Claude Sonnet 4.5 | Implements exactly what was planned — no scope creep; **creates test scenarios for new flows** |
| **Retest** | Haiku 4.5 + GPT-4.1 | Scout decides if Playwright MCP testing is needed; evaluator runs it if so; **runs new test scenarios** |
| **Changelog** | Claude Haiku 4.5 | **Mandatory** — writes `specs/changelog/<timestamp>.md` with Update / New / Technical Debt / Next |

**Mandatory requirements:**
- Every new user-facing flow or API endpoint must have a test scenario in `specs/tests/`
- Every iteration must produce a changelog in `specs/changelog/`

The loop exits early when the agent signals all tasks are complete.

---

## E2E Testing

The agent's Retest phase (and you manually) can run end-to-end scenarios against a live dev server using the **Playwright MCP server**.

### Step 1 — Start the Playwright MCP server

In a dedicated terminal, run:

```bash
npx @playwright/mcp@latest --port 8931
```

Keep this terminal open while tests are running. The server listens on `http://localhost:8931` and gives GitHub Copilot full browser-automation capabilities via MCP.

### Step 2 — Start your dev server

Make sure the application is running at the `BASE_URL` expected by the tests (default `http://localhost:5173`).

### Step 3 — Run the tests

Run a single scenario:

```bash
./run-test.sh specs/tests/<scenario>.md
```

Run all scenarios:

```bash
./run-all-tests.sh
```

### Writing test cases

Every developed feature **must** have a corresponding test scenario file in `specs/tests/` in Markdown format.  
See [specs/tests/homepage-load.md](specs/tests/homepage-load.md) as a reference example.

---

## Project Structure

```
.
├── .github/
│   └── copilot-instructions.md   # Workflow + coding conventions (auto-read by Copilot)
├── specs/
│   ├── architecture/
│   │   ├── requirements.md       # ← Fill this in FIRST before running setup
│   │   └── architecture.md       # Generated by agent on first run
│   ├── changelog/                # Auto-generated per-iteration changelogs
│   └── tests/                    # E2E test scenarios (.md) — one file per feature
├── sample-project/               # Read-only template reference (created by setup.sh)
├── setup.sh                      # One-time initialisation script
├── start-agent-loop.sh           # Main agentic loop runner
├── run-test.sh                   # Run a single test scenario
├── run-all-tests.sh              # Run all test scenarios in specs/tests/
└── README.md                     # This file
```

---

## Specs

### Requirements (`specs/architecture/requirements.md`)

The starting point for the entire project. **Fill this in before running `setup.sh`.** The agent reads it on every Recap and Planning phase as the authoritative source of what needs to be built. Every architectural decision is traced back to a requirement here.

### Architecture specs (`specs/architecture/`)

Place Markdown files here describing the intended system design, constraints, and architectural decisions. The agent reads all `.md` files in this folder during every Recap and Planning phase and must align its plan with what is documented.

### Test scenarios (`specs/tests/`)

**Mandatory for new flows** — Every feature that has been developed **must** have a corresponding `.md` test scenario file here. The agent writes and runs these during the Retest phase; you can also run them manually with `run-test.sh` / `run-all-tests.sh`. Use [specs/tests/homepage-load.md](specs/tests/homepage-load.md) as a starting template.

**Phase 3 (Execute)** requires creating test scenarios for every new user-facing flow or API endpoint, and **Phase 4 (Retest)** verifies they pass.

### Changelogs (`specs/changelog/`)

**Mandatory** — Auto-generated by the agent after every iteration. Each file is named `YYYYMMDD_HHMMSS.md` and contains:

- **Update** — changes made to existing code or features
- **New** — newly added features, files, or capabilities (including test scenarios)
- **Technical Debt** — shortcuts taken or issues to revisit
- **What Should Be Done Next** — deferred items and recommended follow-up tasks

Do not edit these files manually; they serve as the agent's institutional memory across iterations. **Phase 5 (Changelog) can never be skipped** — every iteration must produce a changelog entry.

---

## Configuration

Open `start-agent-loop.sh` and adjust the variables at the top if needed:

| Variable | Default | Description |
|---|---|---|
| `MAX_ITERATIONS` | `10` | Maximum number of Recap→Execute cycles |
| `SAMPLE_PROJECT_DIR` | `sample-project` | Path to the read-only reference repo |
| `CHANGELOG_DIR` | `specs/changelog` | Where timestamped changelogs are written |
| `MODEL_RECAP` | `claude-haiku-4-5` | Model for Recap phase |
| `MODEL_PLAN` | `claude-sonnet-4-6` | Model for Planning phase |
| `MODEL_EXECUTE` | `claude-sonnet-4-5` | Model for Execute phase |
| `MODEL_TEST_FREE` | `claude-haiku-4-5` | Model for Retest scout pass |
| `MODEL_TEST_EVAL` | `gpt-4.1` | Model for Playwright MCP evaluation |

---

## Coding Conventions

All conventions are embedded in `.github/copilot-instructions.md` and are enforced automatically by the agent. They cover:

- **Feature-grouped folder structure** for both client (`src/extensions/`) and server (`server/extensions/`) code
- **API endpoint** method usage, naming, error shape, and response shapes
- **Code module** priorities, noun-based naming, single-object input/output, functional composition
- **Security** — deny-first auth, single identity provider, config-module env access

Refer to [.github/copilot-instructions.md](.github/copilot-instructions.md) for the full reference.
