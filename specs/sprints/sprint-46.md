# Sprint 46 — DB Schema: Board & Card Extensions

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 05 (Board), Sprint 07 (Card Core)  
> **References:** [requirements §7 — Data Model](../architecture/requirements.md)

---

## Goal

Extend the `boards` and `cards` tables with the columns required by the requirements specification that are currently missing. These schema additions unlock several downstream features (board visibility access control, board customisation, timeline/gantt view) without touching any business logic — pure schema + migration work.

---

## Scope

### 1. `db/migrations/0027_board_extensions.ts` (new)

Add the following columns to the `boards` table:

| Column | Type | Default | Notes |
|---|---|---|---|
| `visibility` | `enum('PRIVATE','WORKSPACE','PUBLIC')` | `'WORKSPACE'` | Controls who can access the board outside workspace members |
| `description` | `text` | `null` | User-written board description, nullable |
| `background` | `varchar(255)` | `null` | CSS colour hex or URL of a background image, nullable |

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table.enu('visibility', ['PRIVATE', 'WORKSPACE', 'PUBLIC']).notNullable().defaultTo('WORKSPACE');
    table.text('description').nullable();
    table.string('background', 255).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table.dropColumn('visibility');
    table.dropColumn('description');
    table.dropColumn('background');
  });
}
```

---

### 2. `db/migrations/0028_card_start_date.ts` (new)

Add `start_date` to `cards`:

| Column | Type | Default | Notes |
|---|---|---|---|
| `start_date` | `timestamp` | `null` | Optional start date; required for Timeline/Gantt view (Sprint 54) |

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.timestamp('start_date').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('start_date');
  });
}
```

---

### 3. Board API — expose new columns

Update all `SELECT` queries and response shapes in `server/extensions/board/` to include `visibility`, `description`, and `background`.

- `GET /api/v1/boards/:id` — include fields in response
- `POST /api/v1/workspaces/:id/boards` — accept `visibility`, `description`, `background` in request body (all optional); validate `visibility` against enum
- `PATCH /api/v1/boards/:id` — accept `visibility`, `description`, `background` as patchable fields

---

### 4. Card API — expose `start_date`

- `GET /api/v1/cards/:id` — include `start_date` in response
- `POST /api/v1/lists/:id/cards` — accept `start_date` (ISO 8601, nullable)
- `PATCH /api/v1/cards/:id` — accept `start_date` as patchable field; validate ISO 8601 format

---

### 5. TypeScript types

Update `server/extensions/board/types.ts` and `server/extensions/card/types.ts` (or equivalent) to reflect the new columns.

---

## Acceptance Criteria

- [ ] Migration runs cleanly on a fresh DB and rolls back without error
- [ ] `boards` table has `visibility`, `description`, `background` columns with correct defaults
- [ ] `cards` table has `start_date` column, nullable
- [ ] `PATCH /api/v1/boards/:id` with `{ "visibility": "PUBLIC" }` persists and returns updated board
- [ ] `PATCH /api/v1/cards/:id` with `{ "start_date": "2026-03-10T00:00:00Z" }` persists and returns updated card
- [ ] Invalid `visibility` value returns 400 with a proper error name
