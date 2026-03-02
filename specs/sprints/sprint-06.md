# Sprint 06 — List Management

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §5.4](../architecture/requirements.md), [technical-decisions.md §§7, 9](../architecture/technical-decisions.md)

---

## Goal

Members can create, rename, reorder, and archive lists within a board. Ordering is collision-free under concurrent edits using fractional lexicographic positions.

---

## Scope

### 1. Data Model

New Knex migration (per [requirements §7](../architecture/requirements.md)):

```typescript
// db/migrations/0005_list.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('lists', (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable()
      .references('id').inTable('boards').onDelete('CASCADE');
    table.string('title').notNullable();
    table.string('position').notNullable();  // lexicographic fractional index (technical-decisions.md §7)
    table.boolean('archived').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('lists');
}
```

Migration file: `db/migrations/0005_list.ts`

### 2. Fractional Indexing

Per [technical-decisions.md §7](../architecture/technical-decisions.md) — lexicographic base62 midpoint:

```
server/mods/fractional/
  index.ts      # between(a: string, b: string): string
  initial.ts    # firstPosition(): string
```

**Algorithm:**
- New list appended: `between(lastPosition, "~")` (tilde is high sentinel)
- New list prepended: `between("", firstPosition)` (empty string is low sentinel)
- Insert between A and B: `between(A.position, B.position)`
- Collision (A === B — should never happen with mid-string): server rebalances all positions and broadcasts `list_reordered`

**Client sends:** `{ afterId: string | null }` (ID of the list to insert after, null = prepend)  
**Server resolves:** reads neighbours' `position` values, computes new `position`, persists

### 3. Reorder Endpoint

`POST /api/v1/boards/:id/lists/reorder` — batch position update:

```ts
// Request body
{
  order: string[]   // complete ordered array of list IDs
}
```

Server:
1. Validates all IDs belong to the board
2. Assigns fresh lexicographic positions to the entire sequence
3. Persists in a single `$transaction`
4. Broadcasts `list_reordered` event (WebSocket — stubbed until sprint 09)

**Acceptance (from requirements §5.4):** reordering never drops a list — server validates that `order.length === activeLists.length`.

### 4. Server Extension

```
server/extensions/list/
  api/
    index.ts
    create.ts       # POST /api/v1/boards/:id/lists
    list.ts         # GET  /api/v1/boards/:id/lists  (already in board GET includes)
    update.ts       # PATCH /api/v1/lists/:id
    archive.ts      # PATCH /api/v1/lists/:id/archive
    delete.ts       # DELETE /api/v1/lists/:id
    reorder.ts      # POST /api/v1/boards/:id/lists/reorder
```

### 5. API Routes

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| `POST` | `/api/v1/boards/:id/lists` | MEMBER | Create list |
| `PATCH` | `/api/v1/lists/:id` | MEMBER | Rename list |
| `PATCH` | `/api/v1/lists/:id/archive` | ADMIN | Archive list |
| `DELETE` | `/api/v1/lists/:id` | ADMIN | Delete list (cascades cards) |
| `POST` | `/api/v1/boards/:id/lists/reorder` | MEMBER | Reorder all lists |

### 6. Concurrency Contract

Per [requirements §5.4](../architecture/requirements.md):

- Server resolves all position collisions
- Outcome is deterministic: lower `sequence` (event store order) wins on tie
- Client receives the authoritative resolved order via `list_reordered` event (sprint 09)

### 7. Frontend Extension

```
src/extensions/List/
  components/
    ListColumn.tsx          # vertical card column
    ListHeader.tsx          # title + archive/delete menu
    AddListButton.tsx
  containers/
    BoardPage/              # extends sprint 04's BoardPage
      ListColumn.tsx        # drag target
  hooks/
    useListReorder.ts       # optimistic reorder + rollback
  api.ts
  translations/
    en.json
```

Drag-and-drop: use `@dnd-kit/sortable` (keyboard accessible per [requirements §10](../architecture/requirements.md)).

---

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `list-not-found` | 404 | Invalid list ID |
| `list-board-mismatch` | 400 | List does not belong to board |
| `reorder-count-mismatch` | 400 | `order` array length ≠ active list count |
| `board-archived` | 403 | Write on archived board (from sprint 04) |

---

## Tests

- Unit: `fractional/between()` — midpoints, prepend, append, large sequence
- Integration: create → reorder → verify positions stable, archive list rejects card creation, delete cascades cards

---

## Acceptance Criteria

- [ ] Creating 10 lists produces unique, sortable positions
- [ ] Reorder endpoint assigns new positions preserving the supplied order
- [ ] Reorder with wrong list count returns 400
- [ ] Archived list is excluded from reorder count
- [ ] Concurrent inserts between the same two positions: server resolves deterministically
- [ ] Keyboard drag-drop accessible in UI
