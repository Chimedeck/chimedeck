# Sprint 61 — Automation System: DB Schema & Core Engine

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 07 (Card Core), Sprint 09 (Event Store), Sprint 11 (Activity Log)
> **References:** Automation Overview — https://support.atlassian.com/trello/docs/automation-overview/

---

## Goal

Lay the database foundation and server-side evaluation engine for the full automation system. This sprint delivers the schema, a rule registry, and the plumbing that connects incoming card events to automation evaluation — without yet wiring up a full set of triggers/actions (those follow in Sprints 62–64).

---

## Scope

### 1. DB Migration `0034_automation.ts` (new)

```ts
// ── automations ──────────────────────────────────────────────────────────────
// Top-level record: one entry per rule / button / scheduled command
table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
table.uuid('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
table.uuid('created_by').notNullable().references('id').inTable('users');
table.string('name', 255).notNullable();
table.enu('automation_type', [
  'RULE',           // trigger + actions
  'CARD_BUTTON',    // on-demand from card back
  'BOARD_BUTTON',   // on-demand from board header
  'SCHEDULED',      // calendar-based (cron)
  'DUE_DATE',       // relative to card due date
]).notNullable();
table.boolean('is_enabled').notNullable().defaultTo(true);
table.string('icon', 64).nullable();   // Heroicon name for buttons
table.integer('run_count').notNullable().defaultTo(0);
table.timestamp('last_run_at').nullable();
table.timestamps(true, true);

// ── automation_triggers ───────────────────────────────────────────────────────
// Exactly one trigger per RULE / DUE_DATE automation
table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
table.uuid('automation_id').notNullable().references('id').inTable('automations').onDelete('CASCADE');
table.string('trigger_type', 64).notNullable(); // e.g. 'card.moved', 'card.label_added', …
table.jsonb('config').notNullable().defaultTo('{}'); // trigger-specific params
table.unique(['automation_id']); // one trigger per automation

// ── automation_actions ────────────────────────────────────────────────────────
// Ordered list of actions to run when automation fires
table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
table.uuid('automation_id').notNullable().references('id').inTable('automations').onDelete('CASCADE');
table.integer('position').notNullable().defaultTo(0); // execution order
table.string('action_type', 64).notNullable();        // e.g. 'card.move_to_list'
table.jsonb('config').notNullable().defaultTo('{}');  // action-specific params

// ── automation_run_log ────────────────────────────────────────────────────────
// Immutable audit log; at most 1000 rows retained per automation (oldest purged)
table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
table.uuid('automation_id').notNullable().references('id').inTable('automations').onDelete('CASCADE');
table.uuid('triggered_by_user_id').nullable().references('id').inTable('users');
table.uuid('card_id').nullable().references('id').inTable('cards').onDelete('SET NULL');
table.enu('status', ['SUCCESS', 'PARTIAL', 'FAILED']).notNullable();
table.jsonb('context').notNullable().defaultTo('{}'); // snapshot of what fired it
table.text('error_message').nullable();
table.timestamp('ran_at').notNullable().defaultTo(knex.fn.now());
```

---

### 2. Automation Core Engine

`server/extensions/automation/engine/`

```
engine/
  index.ts           # public API: evaluate({ boardId, event, context })
  matcher.ts         # matches an incoming event against all enabled RULE triggers
  executor.ts        # iterates ordered actions and calls each action handler
  logger.ts          # writes to automation_run_log, caps at 1000 rows
  registry.ts        # maps trigger_type and action_type strings → handler functions
```

**`evaluate()` lifecycle:**
```
1. Load all enabled RULE automations for boardId (cached per request cycle)
2. For each automation: call matcher(event, trigger)
3. Collect matching automations
4. For each match (in parallel, max 5):
     a. Call executor(automation, context)
     b. Catch errors per action, mark overall status SUCCESS|PARTIAL|FAILED
     c. Write to run_log
5. Publish WS event `automation_ran` to board channel
```

---

### 3. Event Pipeline Hook

Attach evaluation to the existing event pipeline in `server/mods/events/`:

```ts
// server/mods/events/dispatch.ts (existing)
import { evaluate } from '../extensions/automation/engine';

// After persisting the event:
await evaluate({ boardId: event.boardId, event, context: { actorId: event.userId } });
```

This is fire-and-forget inside an async try/catch — automation failures must never block card mutations.

---

### 4. Automation API (CRUD)

Base path: `/api/v1/boards/:boardId/automations`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/boards/:boardId/automations` | List automations (with trigger + actions embedded) |
| `POST` | `/api/v1/boards/:boardId/automations` | Create automation |
| `GET` | `/api/v1/boards/:boardId/automations/:id` | Get single automation |
| `PATCH` | `/api/v1/boards/:boardId/automations/:id` | Update (name, enabled, icon, trigger, actions) |
| `DELETE` | `/api/v1/boards/:boardId/automations/:id` | Delete automation |

Response shape:
```json
{
  "data": {
    "id": "...",
    "name": "Move urgent cards",
    "automationType": "RULE",
    "isEnabled": true,
    "icon": "BoltIcon",
    "trigger": { "triggerType": "card.label_added", "config": { "labelId": "..." } },
    "actions": [
      { "id": "...", "position": 0, "actionType": "card.move_to_list", "config": { "listId": "..." } }
    ],
    "runCount": 42,
    "lastRunAt": "..."
  }
}
```

Errors:
- `automation-not-found` (404)
- `automation-type-invalid` (422)
- `trigger-type-unknown` (422)
- `action-type-unknown` (422)

---

### 5. Server Files

```
server/extensions/automation/
  api/
    index.ts          # router
    list.ts
    create.ts
    get.ts
    update.ts
    delete.ts
  engine/
    index.ts
    matcher.ts
    executor.ts
    logger.ts
    registry.ts
  config/
    index.ts          # AUTOMATION_ENABLED flag (Bun.env)
  common/
    types.ts          # AutomationType, TriggerType, ActionType enums
```

---

### 6. Feature Flag

`AUTOMATION_ENABLED` (default: `true` in dev) — gates all automation routes and the event pipeline hook.

---

## Acceptance Criteria

- [ ] DB migration runs cleanly on a fresh database
- [ ] Full CRUD API works for all automation types (RULE, CARD_BUTTON, BOARD_BUTTON, SCHEDULED, DUE_DATE)
- [ ] `evaluate()` is called after every card mutation event but never throws (errors are logged)
- [ ] `automation_run_log` capped at 1000 rows per automation (oldest purged on insert)
- [ ] `AUTOMATION_ENABLED=false` disables all routes and eval hook with no side-effects

---

## Tests

- `tests/integration/automation/crud.test.ts` — CRUD API for all automation types
- `tests/integration/automation/engine.test.ts` — matcher and executor with mock handlers
