# Sprint 52 — View Persistence + Table View

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 05 (Board), Sprint 18 (Board View / Kanban UI), Sprint 46 (Board Schema Extensions)  
> **References:** [requirements §4 — Views, E-VIEW-04](../architecture/requirements.md)

---

## Goal

Two related gaps in the views system are addressed together:

1. **View persistence** — the selected view type (Kanban, Table, Calendar, Timeline) must be persisted server-side per user per board (E-VIEW-04), not just in component state
2. **Table view** — a spreadsheet-style flat table of all cards across all lists on a board, sortable and filterable

---

## Scope

### 1. `db/migrations/0031_user_board_view_prefs.ts` (new)

```ts
table.uuid('id').primary();
table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
table.uuid('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
table.enu('view_type', ['KANBAN', 'TABLE', 'CALENDAR', 'TIMELINE']).notNullable().defaultTo('KANBAN');
table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
table.unique(['user_id', 'board_id']);
```

---

### 2. View Preference API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/boards/:id/view-preference` | Returns the current user's saved view type for this board |
| `PUT` | `/api/v1/boards/:id/view-preference` | Upserts the view type for the current user and board |

Request body for `PUT`:
```json
{ "viewType": "TABLE" }
```

Response: `{ "data": { "viewType": "TABLE" } }`

---

### 3. Board View Switcher UI (`src/extensions/BoardViewSwitcher/`)

```
src/extensions/BoardViewSwitcher/
  BoardViewSwitcher.tsx    # Tab/icon bar: Kanban | Table | Calendar | Timeline
  viewPreference.slice.ts  # Redux slice for active view state
  api.ts                   # RTK Query: GET + PUT view preference
```

- On board load, `GET /boards/:id/view-preference` is called and sets the active view
- Switching tabs calls `PUT /boards/:id/view-preference` and switches the rendered view component
- View switcher is mounted in the board page toolbar, above the lists/columns area

---

### 4. Table View (`src/extensions/TableView/`)

```
src/extensions/TableView/
  TableView.tsx            # Main table component
  TableRow.tsx             # One row per card
  TableHeader.tsx          # Sortable column headers
  useTableSort.ts          # Sort/filter hook
  types.ts
```

#### Columns displayed (default)

| Column | Notes |
|---|---|
| Title | Clicking opens the card detail modal |
| List | Name of the list the card belongs to |
| Assignees | Member avatar chips |
| Labels | Label colour chips |
| Due Date | Formatted date; red if overdue |
| Start Date | Formatted date (from Sprint 46 `start_date`) |
| Value | Currency amount (from Sprint 30) if set |

All columns are sortable. Clicking a column header cycles through `asc → desc → unsorted`.

#### Data source

Reuse the existing `GET /api/v1/boards/:id/cards` endpoint (or equivalent flat cards list). No new API endpoint required.

---

## Acceptance Criteria

- [ ] `user_board_view_prefs` table exists and migration runs cleanly
- [ ] `GET /boards/:id/view-preference` returns the persisted view type for the current user
- [ ] `PUT /boards/:id/view-preference` saves the view type; subsequent `GET` reflects it
- [ ] Board page loads with the user's last-used view type active
- [ ] View switcher tabs render correctly in the board toolbar
- [ ] Table view renders all cards in a flat table with correct column values
- [ ] Clicking a column header sorts the table
- [ ] Clicking a card title in the table opens the card detail modal
