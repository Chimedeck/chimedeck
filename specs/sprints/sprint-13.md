# Sprint 12 — Search & Presence

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

#### Schema additions

```prisma
// Add to Board
searchVector   Unsupported("tsvector")?  @default(dbgenerated("to_tsvector('english', title)"))

// Add to Card
searchVector   Unsupported("tsvector")?  @default(dbgenerated("to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))"))
```

Two stored generated columns, kept in sync by Postgres triggers:

```sql
-- Trigger on Board
CREATE TRIGGER board_search_vector_update
BEFORE INSERT OR UPDATE ON "Board"
FOR EACH ROW EXECUTE FUNCTION tsvector_update_trigger(
  "searchVector", 'pg_catalog.english', "title"
);

-- Trigger on Card
CREATE TRIGGER card_search_vector_update
BEFORE INSERT OR UPDATE ON "Card"
FOR EACH ROW EXECUTE FUNCTION tsvector_update_trigger(
  "searchVector", 'pg_catalog.english', "title", "description"
);
```

GIN indexes on both columns:

```sql
CREATE INDEX board_search_idx ON "Board" USING GIN ("searchVector");
CREATE INDEX card_search_idx  ON "Card"  USING GIN ("searchVector");
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

Sprint 08 implemented the Redis TTL keys; this sprint adds:

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

Already stubbed in sprint 08; this sprint adds full `User` includes (name, avatarUrl).

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

src/extensions/Realtime/   # extend sprint 09
  components/
    PresenceAvatars.tsx     # already created sprint 09; wire to WS presence_update
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
