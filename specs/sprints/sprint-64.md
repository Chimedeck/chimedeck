# Sprint 64 — Automation: Scheduled & Due Date Commands

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 63 (Automation Actions), Sprint 09 (Event Store)
> **References:** Automation

---

## Goal

Enable time-based automations: calendar-scheduled commands that run on a cron-like interval (daily, weekly, monthly, yearly) and due-date commands that fire relative to each card's due date.

**Scheduler architecture:** `pg_cron` (PostgreSQL extension) + `pg_notify` / `LISTEN` — not `setInterval`. `setInterval` is unsuitable because: (1) it runs on the Bun main thread, competing with request handling; (2) every replica fires independently, causing double-runs; (3) missed ticks on restart are silently dropped.

> **Local dev docker image:** Do **not** replace the existing `postgres:16-alpine` image. The Bun Worker fallback (`AUTOMATION_USE_PGCRON=false`) was purpose-built for local dev without the extension. Swapping images would require recreating existing volumes and is unnecessary.
>
> **Production DB (self-hosted):** `pg_cron` is **not** bundled in the standard PostgreSQL packages — it must be installed separately and requires a server restart. See §2 below for the full setup checklist. This is a **pre-deploy ops task** that must be completed before deploying sprint 64.

---

## Scope

### 1. Scheduled Automation Config Schema

Stored in `automations.config` (jsonb):

#### `SCHEDULED` type

```json
{
  "scheduleType": "weekly",
  "dayOfWeek": 1,          // 0=Sunday … 6=Saturday
  "hour": 9,               // 0–23 UTC
  "minute": 0
}
```

Supported `scheduleType` values: `"daily"`, `"weekly"`, `"monthly"` (`dayOfMonth` field), `"yearly"` (`month` + `dayOfMonth`).

#### `DUE_DATE` type

Trigger config stored in `automation_triggers.config`:

```json
{
  "offsetDays": -2,
  "offsetUnit": "days",
  "triggerMoment": "before"
}
```

`triggerMoment`: `"before"` | `"after"` | `"on"`

---

### 2. PostgreSQL Setup — Self-Hosted (pre-deploy ops task)

`pg_cron` is not included in standard PostgreSQL distributions and requires a one-time server-level setup. This must be completed by the ops/DBA team **before** sprint 64 is deployed to production.

#### Step 1 — Install the package (on the PostgreSQL host)

```bash
# Debian / Ubuntu (adjust version to match your PostgreSQL install)
apt-get install -y postgresql-16-cron

# RHEL / Amazon Linux
dnf install -y pg_cron_16
```

If running PostgreSQL in Docker for production, the postgres image must be rebuilt to include `pg_cron`. A `Dockerfile.postgres` building from `postgres:16` (Debian-based, not Alpine) with the package pre-installed is the cleanest approach:

```dockerfile
# Dockerfile.postgres
FROM postgres:16
RUN apt-get update && apt-get install -y postgresql-16-cron && rm -rf /var/lib/apt/lists/*
```

> **Note:** `postgres:16-alpine` cannot be used for this — Alpine does not carry the `pg_cron` package. Debian-based `postgres:16` is required for production Docker deployments. Local dev continues to use `postgres:16-alpine` + the Bun Worker fallback.

#### Step 2 — Enable `shared_preload_libraries`

Add to `postgresql.conf`:

```
shared_preload_libraries = 'pg_cron'
```

Then restart PostgreSQL. This is required — `pg_cron` cannot be loaded at runtime.

#### Step 3 — Create the extension & schedule the job

Run once as a superuser **after** migration `0035_automation_scheduler.ts` has been applied (so the function exists):

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'automation-tick',
  '* * * * *',
  $$SELECT automation_scheduler_tick()$$
);
```

These two steps are **not** included in the Knex migration — they require superuser privilege that the app DB user does not hold.

For **local dev** this entire section is **skipped** — set `AUTOMATION_USE_PGCRON=false` in `.env` to use the Bun Worker fallback instead.

---

### 3. DB Migration `0035_automation_scheduler.ts` (new)

Creates the stored functions only. The `CREATE EXTENSION` and `cron.schedule()` calls are **not** included in this migration (they require superuser and must be run separately — see §2 above).

#### `automation_should_run_now(automation_id uuid)` → `boolean`

Pure SQL function. Reads `automations.config` and compares against `NOW()` UTC fields (day-of-week, hour, minute). Returns `true` when the current minute falls within the scheduled window.

#### `automation_due_date_in_window(due_date timestamptz, trigger_config jsonb)` → `boolean`

Pure SQL function. Calculates whether `NOW()` is within the `offsetDays`/`offsetUnit` window relative to `due_date`.

#### `automation_scheduler_tick()` → `void`

Master tick procedure called every minute by `pg_cron`:

```sql
CREATE OR REPLACE FUNCTION automation_scheduler_tick() RETURNS void AS $$
DECLARE rec RECORD;
BEGIN
  -- SCHEDULED automations
  FOR rec IN
    SELECT id, board_id FROM automations
    WHERE automation_type = 'SCHEDULED' AND is_enabled = TRUE
      AND (last_run_at IS NULL
           OR last_run_at < date_trunc('minute', NOW() - INTERVAL '58 seconds'))
  LOOP
    IF automation_should_run_now(rec.id) THEN
      PERFORM pg_notify('automation_tick',
        json_build_object('type','SCHEDULED','automationId',rec.id,'boardId',rec.board_id)::text);
      UPDATE automations SET last_run_at = NOW() WHERE id = rec.id;
    END IF;
  END LOOP;

  -- DUE_DATE automations
  FOR rec IN
    SELECT a.id AS automation_id, a.board_id, c.id AS card_id
    FROM   automations a
    JOIN   automation_triggers t ON t.automation_id = a.id
    JOIN   cards c ON c.board_id = a.board_id
    WHERE  a.automation_type = 'DUE_DATE' AND a.is_enabled = TRUE
      AND  c.due_date IS NOT NULL
      AND  automation_due_date_in_window(c.due_date, t.config)
      AND  NOT EXISTS (
             SELECT 1 FROM automation_run_log l
             WHERE l.automation_id = a.id AND l.card_id = c.id
               AND l.ran_at >= NOW() - INTERVAL '10 minutes'
           )
  LOOP
    PERFORM pg_notify('automation_tick',
      json_build_object('type','DUE_DATE','automationId',rec.automation_id,
                        'boardId',rec.board_id,'cardId',rec.card_id)::text);
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

> The `pg_cron` job registration is performed by the DBA as a one-time step (see §2). It is intentionally excluded from this migration.

---

### 4. Bun `LISTEN` Client

`server/extensions/automation/scheduler/listener.ts`

```ts
import pg from 'pg';
import { env } from '../../config';
import { execute } from '../engine';

const client = new pg.Client({ connectionString: env.DATABASE_URL });

export async function startAutomationListener(): Promise<void> {
  await client.connect();
  await client.query('LISTEN automation_tick');

  client.on('notification', async (msg) => {
    if (msg.channel !== 'automation_tick') return;
    try {
      const { type, automationId, boardId, cardId } = JSON.parse(msg.payload ?? '{}');
      await execute({ automationId, boardId, cardId: cardId ?? null, actorId: null });
    } catch (err) {
      console.error('[automation-listener]', err);
    }
  });

  // Reconnect on unexpected disconnect (e.g. Postgres restart)
  client.on('error', async () => {
    await client.end().catch(() => {});
    setTimeout(startAutomationListener, 5_000);
  });
}
```

- One dedicated `pg.Client` — never used for regular queries
- Receives notifications asynchronously via the Bun event loop (no polling, no thread blocking)
- Reconnect loop survives PostgreSQL restarts

---

### 5. Bun Worker Fallback (no `pg_cron`)

`server/extensions/automation/scheduler/workerFallback.ts`

For local dev environments where `pg_cron` is not installed:

```ts
// Runs in a Bun Worker thread — isolated from the main HTTP thread
setInterval(async () => {
  await db.raw('SELECT automation_scheduler_tick()');
}, 60_000);
```

Spawned from `scheduler/index.ts` when `AUTOMATION_USE_PGCRON=false`. The same stored procedure is called — no logic duplication. Multi-instance double-fire is acceptable in single-node local dev.

---

### 6. API Extensions

#### `PATCH /api/v1/boards/:boardId/automations/:id`

Accepts `config` for SCHEDULED automations:

```json
{ "config": { "scheduleType": "weekly", "dayOfWeek": 1, "hour": 9, "minute": 0 } }
```

Validation: unknown schedule fields → `{ name: 'schedule-config-invalid' }` (422).

#### `GET /api/v1/boards/:boardId/automations`

Returns `config` embedded in each automation object.

---

### 7. Server Files

```
server/extensions/automation/scheduler/
  index.ts               # entry: starts listener OR worker fallback based on flag
  listener.ts            # pg LISTEN client (pg_cron path)
  workerFallback.ts      # Bun Worker thread (local dev fallback)

server/extensions/automation/engine/
  schedule/
    shouldRunNow.ts      # mirrors automation_should_run_now() for tests + type discovery
    dueDateWindow.ts     # mirrors automation_due_date_in_window() for tests

db/migrations/
  0035_automation_scheduler.ts  # stored functions + pg_cron job
```

---

### 8. Feature Flags

| Flag | Local dev default | Prod default | Effect |
|------|-------------------|--------------|--------|
| `AUTOMATION_SCHEDULER_ENABLED` | `true` | `true` | `false` → listener/worker not started; no time-based automations fire |
| `AUTOMATION_USE_PGCRON` | **`false`** | `true` | `false` → Bun Worker fallback used instead of `pg_cron`; set to `false` locally since `postgres:16-alpine` does not include the extension |

> `AUTOMATION_USE_PGCRON=false` must be set in `.env` for local dev. The prod/staging `.env` files should set it to `true` only after the DBA has run `CREATE EXTENSION pg_cron` on the target database (see §2).

---

## Acceptance Criteria

- [ ] `automation_scheduler_tick()` is covered by SQL unit tests (direct `SELECT` assertions)
- [ ] A SCHEDULED automation with `scheduleType: weekly, dayOfWeek: 1, hour: 9` fires exactly once per week on Monday at 09:00 UTC (verified via mock `NOW()` in SQL tests)
- [ ] `last_run_at` is updated atomically inside the tick, preventing double-fires across replicas
- [ ] A DUE_DATE automation with `offsetDays: -1` fires for each card whose due_date is ~24 hours away
- [ ] Due date automations skip cards already logged in `automation_run_log` within the 10-minute window
- [ ] The LISTEN client reconnects automatically after a PostgreSQL restart
- [ ] `AUTOMATION_SCHEDULER_ENABLED=false` prevents listener and worker from starting
- [ ] `AUTOMATION_USE_PGCRON=false` runs the Bun Worker fallback instead

---

## Tests

- `tests/integration/automation/schedulerTick.test.ts` — call `automation_scheduler_tick()` with controlled `NOW()` via `SET LOCAL TIME ZONE` + seeded automations; verify `pg_notify` payloads using `LISTEN` in the test connection
- `tests/integration/automation/dueDateWindow.test.ts` — `automation_due_date_in_window()` with various offset configs
- `tests/integration/automation/listener.test.ts` — Bun LISTEN client receives notification and calls executor
