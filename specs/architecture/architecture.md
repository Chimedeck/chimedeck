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
  │     ├── visibility: PRIVATE | WORKSPACE | PUBLIC  (default: PRIVATE)
  │     ├── BoardMembers  (explicit members on PRIVATE boards — role: ADMIN|MEMBER|VIEWER)
  │     └── List (fractional-index ordered)
  │           └── Card (fractional-index ordered)
  │                 ├── Labels          (workspace-scoped, max 20 per card)
  │                 ├── CardMembers     (user assignments on cards)
  │                 ├── ChecklistItems  (max 100 per card)
  │                 └── Attachments     (S3 / external URL)

User
  └── Membership → Workspace  (role: Owner | Admin | Member | Viewer | Guest)

BoardGuestAccess
  └── user_id, board_id, granted_by, granted_at
      Grants a GUEST workspace member access to a specific board.
      Guests can view and edit that board only; they cannot see other boards or the workspace member list.

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

### Board Visibility Rules

| Visibility | Who can VIEW | Who can EDIT |
|---|---|---|
| `PRIVATE` (default) | Workspace Owner/Admin always; explicit `board_members` entries for regular Members | Same as view — Members need explicit `board_members` entry |
| `WORKSPACE` | All workspace Members/Admins/Owners | All workspace Members/Admins/Owners |
| `PUBLIC` | Anyone on the internet (no authentication required) | Only explicit `board_members` + workspace Owner/Admin |

**Guest (external user):**
- Has `GUEST` workspace membership role
- Access granted via `board_guest_access` rows (one per board)
- Can view and edit boards they have been added to
- Browsing the workspace shows only their granted boards — not other boards
- Cannot view the workspace member list
- Board creator is automatically added as board `ADMIN` in `board_members` on creation

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


---

## As-Built Update (2026-06-10T19:10:17.134Z)

> **Run ID:** `eb0b76e9-42d3-4a21-aa6d-bf48b79b8f44`

### Implementation Evidence
**Added (322):**
- `.agent-loop-current-log`
- `.agents/skills/stripe-best-practices/SKILL.md`
- `.agents/skills/stripe-best-practices/references/billing.md`
- `.agents/skills/stripe-best-practices/references/connect.md`
- `.agents/skills/stripe-best-practices/references/payments.md`
- `.agents/skills/stripe-best-practices/references/security.md`
- `.agents/skills/stripe-best-practices/references/tax.md`
- `.agents/skills/stripe-best-practices/references/treasury.md`
- `.agents/skills/stripe-projects/SKILL.md`
- `.agents/skills/upgrade-stripe/SKILL.md`
- `.continue/skills/stripe-best-practices`
- `.continue/skills/stripe-projects`
- `.continue/skills/upgrade-stripe`
- `.task.resume`
- `.umbra/commercial.yml`
- `DESIGN.md`
- `console-errors.txt`
- `db/migrations/0119_board_chat_permissions.ts`
- `db/migrations/0120_board_chat_storage.ts`
- `db/migrations/0121_board_github_project_url.ts`
- `db/migrations/0122_notification_list_title.ts`
- `db/migrations/0123_github_app_installations.ts`
- `db/migrations/20260601_workspace_subscriptions.ts`
- `db/migrations/20260603_workspace_subscriptions_extend_tiers.ts`
- `db/migrations/20260608_user_subscriptions.ts`
- `db/migrations/20260609_workspace_plugin_domains.ts`
- `db/migrations/20260610_card_ai_context_snapshots.ts`
- `db/migrations/20260610_mcp_sessions.ts`
- `integrations-flow-report.png`
- `server/common/limits.ts`
- `server/common/requestContext.ts`
- `server/config/__tests__/decodeKey.test.ts`
- `server/config/decodeKey.ts`
- `server/config/feature-gates.test.ts`
- `server/config/feature-gates.ts`
- `server/config/subscription-tiers.ts`
- `server/extensions/aiContext/api/__tests__/fileScope/index.test.ts`
- `server/extensions/aiContext/api/__tests__/gather.test.ts`
- `server/extensions/aiContext/api/fileScope/index.ts`
- `server/extensions/aiContext/api/gather/index.ts`
- `server/extensions/aiContext/api/index.ts`
- `server/extensions/aiContext/common/config/index.ts`
- `server/extensions/aiContext/mods/budget/__tests__/index.test.ts`
- `server/extensions/aiContext/mods/budget/index.ts`
- `server/extensions/aiContext/mods/connectors/__tests__/cardsSearch.test.ts`
- `server/extensions/aiContext/mods/connectors/__tests__/codeSearch.test.ts`
- `server/extensions/aiContext/mods/connectors/__tests__/docsSearch.test.ts`
- `server/extensions/aiContext/mods/connectors/__tests__/gitSearch.test.ts`
- `server/extensions/aiContext/mods/connectors/cardsSearch.ts`
- `server/extensions/aiContext/mods/connectors/codeSearch.ts`
- `server/extensions/aiContext/mods/connectors/docsSearch.ts`
- `server/extensions/aiContext/mods/connectors/gitSearch.ts`
- `server/extensions/aiContext/mods/duplicateDetection/__tests__/index.test.ts`
- `server/extensions/aiContext/mods/duplicateDetection/index.ts`
- `server/extensions/aiContext/mods/fileScopePlanner/__tests__/index.test.ts`
- `server/extensions/aiContext/mods/fileScopePlanner/index.ts`
- `server/extensions/aiContext/mods/gather/index.ts`
- `server/extensions/aiContext/mods/impactAnalysis/__tests__/index.test.ts`
- `server/extensions/aiContext/mods/impactAnalysis/index.ts`
- `server/extensions/aiContext/mods/ranker/__tests__/index.test.ts`
- `server/extensions/aiContext/mods/ranker/index.ts`
- `server/extensions/aiContext/mods/security/__tests__/pathAllowlist.test.ts`
- `server/extensions/aiContext/mods/security/__tests__/secretRedactor.test.ts`
- `server/extensions/aiContext/mods/security/pathAllowlist.ts`
- `server/extensions/aiContext/mods/security/secretRedactor.ts`
- `server/extensions/aiContext/mods/snapshots/__tests__/index.test.ts`
- `server/extensions/aiContext/mods/snapshots/index.ts`
- `server/extensions/aiContext/types.ts`
- `server/extensions/board/api/__tests__/chatAssist.test.ts`
- `server/extensions/board/api/__tests__/chatMessages.test.ts`
- `server/extensions/board/api/__tests__/chatPermissions.test.ts`
- `server/extensions/board/api/__tests__/chatSearch.test.ts`
- `server/extensions/board/api/__tests__/create.test.ts`
- `server/extensions/board/api/__tests__/integrations.test.ts`
- `server/extensions/board/api/__tests__/specs.test.ts`
- `server/extensions/board/api/chatAssist/commit.ts`
- `server/extensions/board/api/chatAssist/create.ts`
- `server/extensions/board/api/chatAssist/index.ts`
- `server/extensions/board/api/chatMessages/create.ts`
- `server/extensions/board/api/chatMessages/get.ts`
- `server/extensions/board/api/chatMessages/index.ts`
- `server/extensions/board/api/chatPermissions/get.ts`
- `server/extensions/board/api/chatPermissions/index.ts`
- `server/extensions/board/api/chatPermissions/patch.ts`
- `server/extensions/board/api/chatSearch/create.ts`
- `server/extensions/board/api/chatSearch/index.ts`
- `server/extensions/board/api/github/specs/__tests__/commit.test.ts`
- `server/extensions/board/api/github/specs/__tests__/save.test.ts`
- `server/extensions/board/api/github/specs/commit.ts`
- `server/extensions/board/api/github/specs/file.ts`
- `server/extensions/board/api/github/specs/index.ts`
- `server/extensions/board/api/integrations/get.ts`
- `server/extensions/board/api/integrations/index.ts`
- `server/extensions/board/api/integrations/patch.ts`
- `server/extensions/board/api/specs/__tests__/load.test.ts`
- `server/extensions/board/api/specs/__tests__/read.test.ts`
- `server/extensions/board/api/specs/index.ts`
- `server/extensions/board/api/specs/load.ts`
- `server/extensions/board/api/specs/read.ts`
- `server/extensions/board/common/config/githubRepository.ts`
- `server/extensions/board/middlewares/__tests__/chatPermissions.test.ts`
- `server/extensions/board/middlewares/chatPermissions.ts`
- `server/extensions/board/mods/__tests__/githubProjectUrl.test.ts`
- `server/extensions/board/mods/chat/__tests__/providerConfig.test.ts`
- `server/extensions/board/mods/chat/assist/__tests__/index.test.ts`
- `server/extensions/board/mods/chat/assist/__tests__/provider.test.ts`
- `server/extensions/board/mods/chat/assist/createBoardCard.ts`
- `server/extensions/board/mods/chat/assist/index.ts`
- `server/extensions/board/mods/chat/assist/proposeGithubDocument.ts`
- `server/extensions/board/mods/chat/assist/provider.ts`
- `server/extensions/board/mods/chat/assist/searchCards.ts`
- `server/extensions/board/mods/chat/messages/__tests__/retry.test.ts`
- `server/extensions/board/mods/chat/messages/__tests__/write.test.ts`
- `server/extensions/board/mods/chat/messages/embedding.ts`
- `server/extensions/board/mods/chat/messages/index.ts`
- `server/extensions/board/mods/chat/messages/retry.ts`
- `server/extensions/board/mods/chat/messages/write.ts`
- `server/extensions/board/mods/chat/providerConfig.ts`
- `server/extensions/board/mods/chat/search/__tests__/query.test.ts`
- `server/extensions/board/mods/chat/search/index.ts`
- `server/extensions/board/mods/chat/search/query.ts`
- `server/extensions/board/mods/chatPermissions.ts`
- `server/extensions/board/mods/githubProjectUrl.ts`
- `server/extensions/board/mods/githubRepository/__tests__/downloadRepositoryFromProjectUrl.test.ts`
- `server/extensions/board/mods/githubRepository/__tests__/githubApp.test.ts`
- `server/extensions/board/mods/githubRepository/downloadRepositoryFromProjectUrl.ts`
- `server/extensions/board/mods/githubRepository/git.ts`
- `server/extensions/board/mods/githubRepository/githubApp.ts`
- `server/extensions/board/mods/githubRepository/index.ts`
- `server/extensions/board/mods/specs/cache.ts`
- `server/extensions/board/mods/specs/commit.ts`
- `server/extensions/board/mods/specs/index.ts`
- `server/extensions/board/mods/specs/manifest.ts`
- `server/extensions/board/mods/specs/read.ts`
- `server/extensions/board/mods/specs/resolvePath.ts`
- `server/extensions/board/mods/specs/write.ts`
- `server/extensions/card/mods/create.ts`
- `server/extensions/githubApp/__tests__/verifySignature.test.ts`
- `server/extensions/githubApp/__tests__/webhook.test.ts`
- `server/extensions/githubApp/api/index.ts`
- `server/extensions/githubApp/api/webhook.ts`
- `server/extensions/githubApp/mods/dispatch.ts`
- `server/extensions/githubApp/mods/installations.ts`
- `server/extensions/githubApp/mods/verifySignature.ts`
- `server/extensions/list/api/__tests__/create.test.ts`
- `server/extensions/subscription/api/createCheckout.ts`
- `server/extensions/subscription/api/createPortal.ts`
- `server/extensions/subscription/api/getEntitlements.ts`
- `server/extensions/subscription/api/getWorkspaceSubscription.ts`
- `server/extensions/subscription/api/index.ts`
- `server/extensions/subscription/api/webhook.ts`
- `server/extensions/subscription/common/enforcement.ts`
- `server/extensions/subscription/common/entitlements.ts`
- `server/extensions/subscription/common/featureKeys.ts`
- `server/extensions/subscription/common/priceTierMap.ts`
- `server/extensions/subscription/common/serializer.ts`
- `server/extensions/subscription/common/subscriptionRepo.ts`
- `server/extensions/subscription/common/syncFromStripe.ts`
- `server/extensions/subscription/common/types.ts`
- `server/extensions/subscription/common/usage.ts`
- `server/extensions/subscription/common/workspaceResolver.ts`
- `server/extensions/workspace/api/__tests__/create.test.ts`
- `server/extensions/workspace/api/__tests__/createSubscriptionPolicy.test.ts`
- `server/middlewares/featureGate.test.ts`
- `server/middlewares/featureGate.ts`
- `server/middlewares/limitGuard.test.ts`
- `server/middlewares/limitGuard.ts`
- `server/middlewares/subscriptionAccessGuard.ts`
- `specs/changelog/20260529_040900.md`
- `specs/changelog/20260601_101234.md`
- `specs/changelog/20260601_135529.md`
- `specs/changelog/20260601_140820.md`
- `specs/changelog/20260601_142000.md`
- `specs/changelog/20260601_142126.md`
- `specs/changelog/20260601_161105.md`
- `specs/changelog/20260601_164051.md`
- `specs/changelog/20260601_164211.md`
- `specs/changelog/20260601_164956.md`
- `specs/changelog/20260601_170025.md`
- `specs/changelog/20260601_170046.md`
- `specs/changelog/20260601_172149.md`
- `specs/changelog/20260601_173316.md`
- `specs/changelog/20260601_174935.md`
- `specs/changelog/20260601_180256.md`
- `specs/changelog/20260601_181824.md`
- `specs/changelog/20260601_182652.md`
- `specs/changelog/20260601_190640.md`
- `specs/changelog/20260601_191125.md`
- `specs/changelog/20260601_193011.md`
- `specs/changelog/20260602_160446.md`
- `specs/changelog/20260602_170532.md`
- `specs/changelog/20260602_171135.md`
- `specs/changelog/20260602_171354.md`
- `specs/changelog/20260602_171613.md`
- `specs/changelog/20260602_172535.md`
- `specs/changelog/20260603_074201.md`
- `specs/changelog/20260603_120000.md`
- `specs/changelog/20260603_124034.md`
- `specs/changelog/20260603_130000.md`
- `specs/changelog/20260603_131500.md`
- `specs/changelog/20260603_133000.md`
- `specs/changelog/20260603_134500.md`
- `specs/changelog/20260603_140500.md`
- `specs/changelog/20260603_141500.md`
- `specs/changelog/20260603_144839.md`
- `specs/changelog/20260603_145714.md`
- `specs/changelog/20260603_150817.md`
- `specs/changelog/20260603_151302.md`
- `specs/changelog/20260603_152413.md`
- `specs/changelog/20260603_154129.md`
- `specs/changelog/20260603_160613.md`
- `specs/changelog/20260603_163341.md`
- `specs/changelog/20260603_164700.md`
- `specs/changelog/20260603_165824.md`
- `specs/changelog/20260603_170627.md`
- `specs/changelog/20260603_171559.md`
- `specs/changelog/20260603_174916.md`
- `specs/changelog/20260603_181743.md`
- `specs/changelog/20260603_182149.md`
- `specs/changelog/20260603_184109.md`
- `specs/changelog/20260603_185000.md`
- `specs/changelog/20260603_190844.md`
- `specs/changelog/20260603_191900.md`
- `specs/changelog/20260603_193114.md`
- `specs/changelog/20260603_195159.md`
- `specs/changelog/20260603_201432.md`
- `specs/changelog/20260603_203602.md`
- `specs/changelog/20260603_204245.md`
- `specs/changelog/20260603_212342.md`
- `specs/changelog/20260603_213327.md`
- `specs/changelog/20260603_213444.md`
- `specs/changelog/20260603_214838.md`
- `specs/changelog/20260603_215201.md`
- `specs/changelog/20260603_220649.md`
- `specs/changelog/20260603_224200.md`
- `specs/changelog/20260603_225328.md`
- `specs/changelog/20260603_230410.md`
- `specs/changelog/20260603_232231.md`
- `specs/changelog/20260603_233120.md`
- `specs/changelog/20260603_234544.md`
- `specs/changelog/20260604_001501.md`
- `specs/changelog/20260604_003733.md`
- `specs/changelog/20260605_120000.md`
- `specs/changelog/20260605_121500.md`
- `specs/changelog/20260605_123000.md`
- `specs/changelog/20260605_124500.md`
- `specs/changelog/20260605_130000.md`
- `specs/changelog/20260605_160805.md`
- `specs/changelog/20260608_120000.md`
- `specs/changelog/20260610_120000.md`
- `specs/changelog/20260610_154122.md`
- `specs/sprints/sprint-158.md`
- `specs/sprints/sprint-159.md`
- `specs/sprints/sprint-160.md`
- `specs/sprints/sprint-161.md`
- `specs/sprints/sprint-162.md`
- `specs/sprints/sprint-163.md`
- `specs/sprints/sprint-164.md`
- `specs/sprints/sprint-165.md`
- `specs/sprints/sprint-166.md`
- `specs/sprints/sprint-167.md`
- `specs/sprints/sprint-168.md`
- `specs/sprints/sprint-169.md`
- `specs/sprints/sprint-170.md`
- `specs/sprints/sprint-171.md`
- `specs/sprints/sprint-172.md`
- `specs/sprints/sprint-173.md`
- `specs/sprints/sprint-174.md`
- `specs/sprints/sprint-175.md`
- `specs/sprints/sprint-176.md`
- `specs/tests/39-board-chat-assist-create-card.md`
- `src/common/utils/escapeScriptTags.ts`
- `src/common/utils/sanitizeUserGeneratedHtml.ts`
- `src/extensions/Board/components/__tests__/BoardHeader.boardChat.test.tsx`
- `src/extensions/Board/config/boardChatConfig.ts`
- `src/extensions/Board/containers/BoardPage/__tests__/BoardPage.boardChat.test.tsx`
- `src/extensions/Board/containers/BoardPage/__tests__/BoardPage.documentation.test.tsx`
- `src/extensions/Board/containers/BoardSettings/GithubProjectUrlSetting.tsx`
- `src/extensions/Board/containers/BoardSettings/__tests__/BoardSettings.githubProjectUrl.test.tsx`
- `src/extensions/Board/mods/__tests__/githubProjectUrl.test.ts`
- `src/extensions/Board/mods/githubProjectUrl.ts`
- `src/extensions/BoardChat/api.ts`
- `src/extensions/BoardChat/components/BoardChatButton.tsx`
- `src/extensions/BoardChat/components/BoardChatDrawer.tsx`
- `src/extensions/BoardChat/components/__tests__/BoardChatDrawer.test.tsx`
- `src/extensions/BoardChat/hooks/useBoardChatHistory.ts`
- `src/extensions/BoardChat/index.ts`
- `src/extensions/DeveloperDocs/components/SpecsFileTree.tsx`
- `src/extensions/DeveloperDocs/components/SpecsMarkdownEditor.tsx`
- `src/extensions/DeveloperDocs/components/__tests__/SpecsWorkspacePage.test.tsx`
- `src/extensions/DeveloperDocs/containers/SpecsWorkspacePage/SpecsWorkspacePage.tsx`
- `src/extensions/DeveloperDocs/containers/SpecsWorkspacePage/__tests__/SpecsWorkspacePage.reducer.test.ts`
- `src/extensions/DeveloperDocs/containers/SpecsWorkspacePage/__tests__/SpecsWorkspacePage.test.tsx`
- `src/extensions/Subscription/api.ts`
- `src/extensions/Subscription/containers/BillingPage/BillingPage.tsx`
- `src/extensions/Subscription/containers/SubscriptionCheckoutPage/SubscriptionCheckoutPage.tsx`
- `src/extensions/Subscription/routes.ts`
- `src/extensions/Subscription/translations/en.json`
- `terraform/bootstrap_commercial/.terraform.lock.hcl`
- `terraform/bootstrap_commercial/main.tf`
- `terraform/bootstrap_commercial/outputs.tf`
- `terraform/bootstrap_commercial/variables.tf`
- `terraform/environments/commercial/.terraform.lock.hcl`
- `terraform/environments/commercial/backend.tf`
- `terraform/environments/commercial/main.tf`
- `terraform/environments/commercial/outputs.tf`
- `terraform/environments/commercial/terraform.tfvars.example`
- `terraform/environments/commercial/variables.tf`
- `tests/db/migrations/20260601_workspace_subscriptions.test.ts`
- `tests/integration/subscriptionApi.test.ts`
- `tests/integration/workspaceCreateSubscriptionPolicy.test.ts`
- `tests/server/common/limits.test.ts`
- `tests/server/common/requestContext.test.ts`
- `tests/server/config/subscription-tiers.test.ts`
- `tests/server/extensions/subscription/api/webhook.test.ts`
- `tests/server/extensions/subscription/common/entitlements.test.ts`
- `tests/server/extensions/subscription/common/featureKeys.test.ts`
- `tests/server/extensions/subscription/common/subscriptionRepo.test.ts`
- `tests/server/extensions/subscription/common/syncFromStripe.test.ts`
- `tests/setup.ts`
- `useBoardChatHistory-requests.txt`
- `vitest.config.ts`

**Modified (90):**
- `.env.example`
- `.gitignore`
- `README.md`
- `bun.lock`
- `db/seeds/trello-import.ts`
- `package.json`
- `server/common/sanitize.ts`
- `server/config/env.ts`
- `server/config/featureFlags.ts`
- `server/extensions/activity/config/visibleEventTypes.ts`
- `server/extensions/activity/mods/__tests__/createActivityEvent.test.ts`
- `server/extensions/activity/mods/createActivityEvent.ts`
- `server/extensions/activity/mods/mapActivityToNotification.ts`
- `server/extensions/attachment/api/multipart/start.ts`
- `server/extensions/attachment/api/requestUploadUrl.ts`
- `server/extensions/attachment/common/config/s3.ts`
- `server/extensions/auth/api/login.ts`
- `server/extensions/auth/common/emailDomain.ts`
- `server/extensions/auth/middlewares/authentication.ts`
- `server/extensions/auth/mods/token/issue.ts`
- `server/extensions/auth/mods/token/verify.ts`
- `server/extensions/board/api/create.ts`
- `server/extensions/board/api/guests/create.ts`
- `server/extensions/board/api/index.ts`
- `server/extensions/board/api/members/create.ts`
- `server/extensions/board/types.ts`
- `server/extensions/card/api/create.ts`
- `server/extensions/comment/api/create.ts`
- `server/extensions/comment/api/update.ts`
- `server/extensions/list/api/create.ts`
- `server/extensions/mcp/http/index.ts`
- `server/extensions/mcp/http/sessions.ts`
- `server/extensions/notifications/api/list.ts`
- `server/extensions/notifications/mods/boardActivityDispatch.ts`
- `server/extensions/plugins/mods/getPluginCspOrigins.ts`
- `server/extensions/search/mods/queryBoardSearch.ts`
- `server/extensions/search/mods/queryWorkspaceSearch.ts`
- `server/extensions/workspace/api/create.ts`
- `server/extensions/workspace/api/get.ts`
- `server/extensions/workspace/api/update.ts`
- `server/index.ts`
- `server/middlewares/rateLimiter.ts`
- `server/mods/flags/defaults.ts`
- `server/mods/helmet.ts`
- `skills-lock.json`
- `specs/sprints/sprint-plan.md`
- `src/common/api/client.ts`
- `src/common/components/Toast.tsx`
- `src/common/translations/en.json`
- `src/common/utils/attachmentMarkdown.ts`
- `src/extensions.ts`
- `src/extensions/Auth/containers/ConfirmEmailChangePage/ConfirmEmailChangePage.tsx`
- `src/extensions/Auth/containers/ForgotPasswordPage/ForgotPasswordPage.tsx`
- `src/extensions/Auth/containers/LoginPage/LoginPage.tsx`
- `src/extensions/Auth/containers/ResetPasswordPage/ResetPasswordPage.tsx`
- `src/extensions/Auth/containers/SignupPage/SignupPage.tsx`
- `src/extensions/Auth/containers/VerifyEmailPage/VerifyEmailPage.tsx`
- `src/extensions/Board/api.ts`
- `src/extensions/Board/components/BoardHeader.tsx`
- `src/extensions/Board/containers/BoardPage/BoardPage.tsx`
- `src/extensions/Board/containers/BoardSettings/BoardSettings.tsx`
- `src/extensions/Board/translations/en.json`
- `src/extensions/Card/components/CardDescription.tsx`
- `src/extensions/Card/components/CardDescriptionTiptap.tsx`
- `src/extensions/Card/components/CardMetaStrip.tsx`
- `src/extensions/Card/components/ChecklistItem.tsx`
- `src/extensions/Comment/components/CommentEditor.tsx`
- `src/extensions/Comment/components/CommentItem.tsx`
- `src/extensions/List/components/AddListForm.tsx`
- `src/extensions/List/containers/BoardPage/ListColumn.tsx`
- `src/extensions/Mention/TiptapMentionExtension.ts`
- `src/extensions/Notification/components/NotificationItem.tsx`
- `src/extensions/Notification/containers/NotificationContainer.tsx`
- `src/extensions/Notification/hooks/useNotificationSync.ts`
- `src/extensions/Notification/slices/notificationSlice.ts`
- `src/extensions/Realtime/client/socket.ts`
- `src/extensions/StateTransitions/components/TransitionsActiveBanner.tsx`
- `src/extensions/Workspace/components/CreateWorkspaceModal.tsx`
- `src/extensions/Workspace/containers/WorkspacePage/WorkspacePage.tsx`
- `src/extensions/Workspace/duck/workspaceDuck.ts`
- `src/extensions/Workspace/translations/en.json`
- `src/layout/Sidebar.tsx`
- `src/routing/index.tsx`
- `src/slices/featureFlagsSlice.ts`
- `start-agent-loop.sh`
- `terraform/environments/stable/main.tf`
- `terraform/modules/ec2-fleet-fixed/main.tf`
- `tests/integration/auth/emailDomainRestriction.test.ts`
- `tests/integration/rateLimiter.test.ts`
- `vite.config.ts`


No merged PRs found.

