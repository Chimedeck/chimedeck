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

Automation (board-scoped)
  ├── AutomationTrigger  (exactly one per RULE / DUE_DATE automation)
  ├── AutomationAction[] (ordered; shared by all automation types)
  └── AutomationRunLog[] (immutable audit; capped at 1 000 rows per automation)

Notification
  └── user_id, type, source_type, source_id, card_id, board_id, actor_id, read
      type: 'mention' | 'card_created' | 'card_moved' | 'card_commented'

NotificationPreference
  └── user_id, type, in_app_enabled, email_enabled
      One row per (user, type); missing rows default to both channels enabled (opt-out model)
      type: 'mention' | 'card_created' | 'card_moved' | 'card_commented'
```

All entity IDs: CUID2 (sortable). Positions: lexicographic base-62 fractional index.

---

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.2 — native TS, hot-reload via `--hot` |
| HTTP / WS | `Bun.serve` — built-in WebSocket, no extra deps |
| Database | PostgreSQL 16 + Knex query builder + `pg` driver |
| Migrations | Knex `knex migrate:latest` — files in `db/migrations/` named `000N_<description>.ts` |
| Cache / Pub-Sub | Redis 7 (prod) **or** `node-cache` + `EventEmitter` (local dev) |
| File storage | AWS S3 (prod) / LocalStack (local dev) via `@aws-sdk/client-s3`; `USE_LOCAL_STORAGE` flag switches endpoint |
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
    attachment/              # Sprint 12 / 59 — file upload, S3, multipart, thumbnails
    search/                  # Sprint 13 — full-text search
    automation/              # Sprint 61–68 — automation engine, triggers, actions, scheduler
      api/                   #   REST endpoints (CRUD + run + quota + log)
      engine/                #   matcher, executor, registry (triggers + actions)
      scheduler/             #   pg_cron tick function (migration) + LISTEN client (listener.ts)
      config/                #   AUTOMATION_ENABLED, AUTOMATION_SCHEDULER_ENABLED, AUTOMATION_USE_PGCRON flags
    notifications/           # Sprint 26 / 70–73 — in-app notifications + email dispatch
      api/
        index.ts             #   mount list, markRead, markAllRead, delete, preferences sub-routes
        list.ts              #   GET  /api/v1/notifications (supports ?type= filter)
        markRead.ts          #   PATCH /api/v1/notifications/:id/read
        markAllRead.ts       #   PATCH /api/v1/notifications/read-all
        delete.ts            #   DELETE /api/v1/notifications/:id
        preferences/
          index.ts           #   mount GET + PATCH
          get.ts             #   GET  /api/v1/notifications/preferences
          update.ts          #   PATCH /api/v1/notifications/preferences
      mods/
        dispatch.ts          #   mention notification creation + WS push (Sprint 26)
        boardActivityDispatch.ts  # card_created / card_moved / card_commented in-app + email (Sprints 72–73)
        preferenceGuard.ts   #   lookup helper; falls back to all-enabled when no row exists
        emailDispatch.ts     #   gated SES dispatch helper (Sprint 72)
        emailTemplates/
          mention.ts
          cardCreated.ts
          cardMoved.ts
          cardCommented.ts
          shared.ts          #   base HTML wrapper + plain-text fallback
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
  db/
    knexfile.ts            # Knex config (reads DATABASE_URL from env)
    migrations/            # 000N_<description>.ts files
    seeds/                 # optional seed scripts
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
    Attachments/             # Sprint 12 / 60 — file upload UI, drag-and-drop, thumbnails
    Search/                  # Sprint 13 — search overlay
    Automation/              # Sprint 65–68 — Automation panel, rule builder, buttons, schedule, log
      api.ts                 #   RTK Query endpoints
      components/
        AutomationHeaderButton.tsx  # BoltIcon in board header (left of ... menu)
        AutomationPanel/            # slide-in panel; tabs: Rules / Buttons / Schedule / Log
        CardButtons/                # card-back automation buttons
        BoardButtons/               # board-header action buttons
        SchedulePanel/              # calendar + due-date command builders
        LogPanel/                   # run history, quota bar
        shared/
          IconPicker.tsx            # 24 selectable Heroicons for button customisation
    Notifications/           # Sprint 26 / 70–73 — notification bell, panel, preferences
      components/
        NotificationBell.tsx        # badge + popover trigger
        NotificationPanel/          # list of notifications with icons per type
        NotificationItem.tsx        # mention / card_created / card_moved / card_commented rows
      NotificationPreferences/
        NotificationPreferencesPanel.tsx  # 4×2 toggle matrix in Profile Settings
        notificationPreferences.slice.ts  # RTK Query: GET + PATCH preferences
        types.ts
      hooks/
        useNotifications.ts         # WS subscription + Redux update
    AdminInvite/             # Sprint 44–45 / 74 — external user invite + auto-verify
      api.ts                 #   RTK Query: POST /api/v1/admin/users
      InviteExternalUserModal.tsx   # form: email, name, password, send-email toggle, auto-verify checkbox
      CredentialSheet.tsx    #   verification status + copyable credentials
      adminInvite.slice.ts
      types.ts
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

## 10. Notification System

Full spec: [Sprints 26](../sprints/sprint-26.md), [70](../sprints/sprint-70.md), [71](../sprints/sprint-71.md), [72](../sprints/sprint-72.md), [73](../sprints/sprint-73.md)

### Notification channels

The notification system has two independent delivery channels. Each can be toggled per user, per notification type via `NotificationPreference`:

| Channel | Mechanism | Sprint introduced |
|---------|-----------|------------------|
| **In-app** | WS push to `user:<userId>` channel + persistent row in `notifications` table | Sprint 26 |
| **Email** | SES transactional email via `emailDispatch.ts` | Sprint 72 |

### Notification types

| Type | Trigger event | Recipients |
|------|--------------|-----------|
| `mention` | User @mentioned in card description or comment | Mentioned user only |
| `card_created` | `card.created` event | All board members except actor |
| `card_moved` | `card.moved` event | All board members except actor |
| `card_commented` | `comment.created` event | All board members except actor |

### Dispatch pipeline

```
Board event persisted (events/dispatch.ts)
  └──▶ boardActivityDispatch.ts  (fire-and-forget)
         ├── For each board member (excluding actor):
         │     ├── preferenceGuard.getPreference({ userId, type })
         │     ├── if in_app_enabled → insert notifications row + WS push to user:<userId>
         │     └── if email_enabled && SES_ENABLED && EMAIL_NOTIFICATIONS_ENABLED
         │               → dispatchNotificationEmail(...)  [fire-and-forget]
         └── Failures are caught, logged — never block the originating mutation

@mention created (mention sync hook)
  └──▶ dispatch.ts
         ├── if in_app_enabled → insert notifications row + WS push to user:<userId>
         └── if email_enabled → dispatchNotificationEmail({ type: 'mention', ... })
```

### Preference model

Stored in `notification_preferences` table (`user_id`, `type`, `in_app_enabled`, `email_enabled`).
Missing rows are treated as both channels enabled (opt-out model).
When `NOTIFICATION_PREFERENCES_ENABLED=false`, the guard always returns all-enabled.

### Feature flags

| Flag | Default | Effect when `false` |
|------|---------|---------------------|
| `NOTIFICATION_PREFERENCES_ENABLED` | `true` | Treats all channels as enabled for all users |
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` | No notification emails dispatched (SES still used for verification etc.) |

---

## 11. Automation System

Full spec: [Sprints 61–68](../sprints/sprint-61.md)

### Automation types

| Type | Triggered by | Typical use |
|------|-------------|-------------|
| `RULE` | Any board event matching a trigger predicate | "When card moved to Done, mark due date complete" |
| `CARD_BUTTON` | Explicit button press on a card's back panel | "Move forward to Review, assign owner, set due +3 days" |
| `BOARD_BUTTON` | Explicit button press in the board header | "Sort backlog by story points" |
| `SCHEDULED` | Cron-like calendar interval (daily/weekly/monthly) | "Every Monday 09:00: archive Done, move Next Sprint → To Do" |
| `DUE_DATE` | Offset relative to a card's `due_date` | "2 days before due: add red label, post @card comment" |

### Evaluation pipeline (RULE type)

```
Card mutation
  └──▶ Event persisted to `events` table
         └──▶ events/dispatch.ts calls automation/engine/evaluate()
                └──▶ matcher.ts — tests each enabled RULE trigger against the event
                       └──▶ executor.ts — runs ordered action handlers inside a DB transaction
                              └──▶ logger.ts — writes to automation_run_log
                                     └──▶ WS broadcast: `automation_ran` event to board channel
```

Automation evaluation is **fire-and-forget** inside an async `try/catch` — a failing automation never blocks the originating mutation.

### Scheduler workers (SCHEDULED + DUE_DATE types)

Time-based automations use **`pg_cron` + `pg_notify` / `LISTEN`** — not `setInterval`. This is non-blocking and replica-safe.

- **`pg_cron`** (PostgreSQL extension) runs `automation_scheduler_tick()` stored procedure every minute inside the database
- The stored procedure finds due SCHEDULED automations and cards inside a DUE_DATE window, then calls `pg_notify('automation_tick', payload::text)` for each
- **`scheduler/listener.ts`** holds one dedicated `pg` connection, executes `LISTEN automation_tick`, and dispatches payloads to `engine/execute()` asynchronously — pure I/O event, never blocks the main thread
- Across replicas `pg_cron` fires exactly once (it runs inside PostgreSQL, not in each app instance)
- `AUTOMATION_SCHEDULER_ENABLED` flag controls whether the listener is started; `AUTOMATION_USE_PGCRON` controls whether `pg_cron` or the Bun-Worker fallback is used (local dev without the extension)
- Full spec: [technical-decisions.md §18.5](./technical-decisions.md)

### Action execution contract

- All actions within one rule run share **a single Knex transaction**
- A failing individual action is caught, logged, and execution continues (status → `PARTIAL`)
- Variable substitution in text fields: `{cardName}`, `{boardName}`, `{listName}`, `{date}`, `{dueDate}`, `{triggerMember}`

### DB schema (short form)

```
automations         id, board_id, created_by, name, automation_type, is_enabled, icon, run_count
automation_triggers  id, automation_id, trigger_type, config (jsonb)
automation_actions   id, automation_id, position, action_type, config (jsonb)
automation_run_log   id, automation_id, card_id, status, context (jsonb), error_message, ran_at
                     └── capped at 1 000 rows per automation (oldest purged on insert)
```

### API surface (summary)

```
GET    /api/v1/boards/:id/automations
POST   /api/v1/boards/:id/automations
GET    /api/v1/boards/:id/automations/:automationId
PATCH  /api/v1/boards/:id/automations/:automationId
DELETE /api/v1/boards/:id/automations/:automationId

POST   /api/v1/cards/:cardId/automation-buttons/:automationId/run    # CARD_BUTTON
POST   /api/v1/boards/:boardId/automation-buttons/:automationId/run  # BOARD_BUTTON

GET    /api/v1/boards/:id/automations/:automationId/runs  # run log (paginated)
GET    /api/v1/boards/:id/automation-runs                 # board-wide log
GET    /api/v1/boards/:id/automation-quota                # monthly quota usage

GET    /api/v1/automation/trigger-types   # discovery — config schemas
GET    /api/v1/automation/action-types    # discovery — config schemas
```

### UI entry point

- A `BoltIcon` (Heroicons solid, 20 px) button sits **immediately to the left of the `...` board menu** in the board header (`AutomationHeaderButton`)
- Clicking opens a slide-in `AutomationPanel` drawer with four tabs: **Rules**, **Buttons**, **Schedule**, **Log**
- Card buttons surface in every card's back panel under an "Automation" section
- Board buttons render as an icon strip in the board header to the left of the `BoltIcon`

### Feature flags

| Flag | Default | Effect when `false` |
|------|---------|---------------------|
| `AUTOMATION_ENABLED` | `true` | All automation routes return 404; event-pipeline hook skipped |
| `AUTOMATION_SCHEDULER_ENABLED` | `true` | `pg_notify` LISTEN client not started; no scheduled or due-date automations fire |
| `AUTOMATION_USE_PGCRON` | `true` (prod) | `false` → Bun Worker fallback calls `automation_scheduler_tick()` directly via SQL every 60 s (local dev without `pg_cron` extension) |
| `AUTOMATION_MONTHLY_QUOTA` | `1000` | Maximum automation runs per board per calendar month |

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
