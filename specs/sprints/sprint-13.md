# Sprint 13 — Search & Presence

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §§6, 9](../architecture/requirements.md), [real_time_sync_protocol.md](../architecture/real_time_sync_protocol.md), [technical-decisions.md §§5, 9](../architecture/technical-decisions.md)

---

## Goal

Users can search for boards and cards within a workspace (full-text). Presence indicators show who is currently active on a board in real time.

---

## Scope

### 1. Full-Text Search

**Decision:** PostgreSQL `tsvector` + `tsquery` (no external search service required at this scale)

Per [technical-decisions.md §2](../architecture/technical-decisions.md) — stays within PostgreSQL.

#### Schema additions (Knex migration)

```typescript
// db/migrations/0012_search_vectors.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add tsvector generated columns
  await knex.schema.alterTable('boards', (table) => {
    table.specificType('search_vector', 'tsvector');
  });
  await knex.schema.alterTable('cards', (table) => {
    table.specificType('search_vector', 'tsvector');
  });

  // Triggers keep vectors in sync on INSERT / UPDATE
  await knex.raw(`
    CREATE TRIGGER boards_search_vector_update
    BEFORE INSERT OR UPDATE ON boards
    FOR EACH ROW EXECUTE FUNCTION
      tsvector_update_trigger(search_vector, 'pg_catalog.english', title);
  `);
  await knex.raw(`
    CREATE TRIGGER cards_search_vector_update
    BEFORE INSERT OR UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION
      tsvector_update_trigger(search_vector, 'pg_catalog.english', title, description);
  `);

  // GIN indexes for fast full-text search
  await knex.raw(`CREATE INDEX boards_search_idx ON boards USING GIN (search_vector)`);
  await knex.raw(`CREATE INDEX cards_search_idx  ON cards  USING GIN (search_vector)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS cards_search_idx`);
  await knex.raw(`DROP INDEX IF EXISTS boards_search_idx`);
  await knex.raw(`DROP TRIGGER IF EXISTS cards_search_vector_update ON cards`);
  await knex.raw(`DROP TRIGGER IF EXISTS boards_search_vector_update ON boards`);
  await knex.schema.alterTable('cards', (table) => { table.dropColumn('search_vector'); });
  await knex.schema.alterTable('boards', (table) => { table.dropColumn('search_vector'); });
}
```

Migration: `0012_search`

#### API Route

```
GET /api/v1/workspaces/:id/search?q=<query>&type=board|card&limit=20&cursor=<id>
```

- `type` is optional; omitting returns both boards and cards
- Min `q` length: 2 characters
- Response:

```ts
{
  data: Array<Board | Card>,
  metadata: { cursor: string | null, hasMore: boolean }
}
```

- Archived boards and cards are excluded by default; include with `?includeArchived=true`

#### Implementation

```
server/extensions/search/
  api/
    index.ts
    query.ts      # GET /api/v1/workspaces/:id/search
  mods/
    buildQuery.ts  # construct tsquery from user input (sanitize special chars)
    rank.ts        # ORDER BY ts_rank_cd(searchVector, query) DESC
```

### 2. Presence (Final Implementation)

Sprint 09 implemented the Redis TTL keys; this sprint adds:

#### Presence WS Event

New `presence_update` WS event broadcast to all board subscribers when a user joins or leaves:

```ts
{
  type: "presence_update",
  board_id: string,
  users: Array<{ id: string, name: string, avatarUrl: string }>
}
```

Published by:
- `subscribe` handler → user joins
- WS disconnect / `unsubscribe` → user leaves
- Background job checks expired presence keys every 10 s (Redis `SCAN presence:<boardId>:*` for keys near expiry)

#### Presence API

```
GET /api/v1/boards/:id/presence
→ { data: User[] }
```

Already stubbed in sprint 09; this sprint adds full `User` includes (name, avatarUrl).

### 3. Frontend Extension

```
src/extensions/Search/
  components/
    SearchModal.tsx         # command-palette style (Cmd+K)
    SearchResultItem.tsx    # board tile or card row
    SearchInput.tsx         # debounced input (300 ms)
  hooks/
    useSearch.ts            # RTK Query + debounce
  api.ts
  translations/
    en.json

src/extensions/Realtime/   # extend sprint 10
  components/
    PresenceAvatars.tsx     # already created sprint 10; wire to WS presence_update
```

**Search UX:**
- Cmd+K / Ctrl+K opens search modal globally
- Results grouped by type (Boards / Cards)
- Click → navigate to board or open card modal

### 4. Indexing Existing Data

Migration `0012_search` must also populate `searchVector` for all existing rows:

```sql
UPDATE "Board" SET "searchVector" = to_tsvector('english', "title");
UPDATE "Card"  SET "searchVector" = to_tsvector('english', coalesce("title",'') || ' ' || coalesce("description",''));
```

---

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `search-query-too-short` | 400 | `q` length < 2 |
| `search-query-invalid` | 400 | tsquery parse error after sanitization |

---

## Tests

- Unit: `buildQuery.ts` sanitizes special tsquery characters (`!`, `&`, `|`)
- Integration: create board + card → search by partial title → verify in results; archived items excluded by default
- E2E: Cmd+K opens modal, type query, click result navigates correctly

---

## Acceptance Criteria

- [ ] Search returns boards and cards matching partial `q` within the caller's workspace
- [ ] Search respects board/workspace RBAC (VIEWER can search within workspace only)
- [ ] Archived records excluded unless `?includeArchived=true`
- [ ] Search query < 2 chars returns 400
- [ ] GIN indexes used (verify with `EXPLAIN ANALYZE` in tests)
- [ ] Presence `presence_update` event fires within 35 s of join/leave
- [ ] `GET /api/v1/boards/:id/presence` returns full User objects
