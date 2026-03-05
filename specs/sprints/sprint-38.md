# Sprint 38 — Plugin Data: Explicit Board Isolation & Cross-Board Validation

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 37 (Plugin SDK Context Queries, Data Storage Fix & Button Callbacks)
> **Architecture reference:** [`specs/architecture/plugins.md`](../architecture/plugins.md)

---

## Goal

Make plugin data storage explicitly board-scoped. Currently the `plugin_data` table has no `board_id` column, `boardId` is accepted by the GET/SET API but silently ignored in the database query, and `scope='member'` data is shared globally across all boards for the same user+plugin. This sprint:

1. Adds a `board_id` column to `plugin_data` and migrates the schema.
2. Uses `boardId` in all read/write queries, ensuring data stored by the escrow plugin on board A is invisible on board B.
3. Validates that the given `resourceId` (card, list) actually belongs to the given `boardId`, preventing cross-board data injection.
4. Updates the host bridge and SDK so `boardId` is always carried through the data flow without plugin authors needing to think about it.

When this sprint is done:
- A `t.set('card', 'private', 'paymentStatus', 'success')` on board A cannot be read back on board B even if the cardId is known.
- `t.set('member', ...)` is isolated per board — a user's payment status on board A is independent of board B.
- The server validates that the cardId / listId passed as `resourceId` actually belongs to the board making the request.

---

## Scope

### 1. DB Migration — add `board_id` to `plugin_data`

**File:** `db/migrations/0022_plugin_data_board_id.ts`

```typescript
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plugin_data', (table) => {
    // Nullable initially to allow migration of existing rows (set to NULL = "global")
    table.string('board_id')
      .nullable()
      .references('id')
      .inTable('boards')
      .onDelete('CASCADE');
  });

  // Backfill: existing plugin_data rows have no board context — leave as NULL.
  // These rows become unreachable by the new query (which requires board_id match)
  // effectively expiring any pre-existing test data.

  // Drop old unique constraint, add new one that includes board_id
  await knex.raw(`
    ALTER TABLE plugin_data
    DROP CONSTRAINT IF EXISTS plugin_data_plugin_id_scope_resource_id_user_id_key_unique;
  `);

  await knex.schema.alterTable('plugin_data', (table) => {
    table.unique(['plugin_id', 'board_id', 'scope', 'resource_id', 'user_id', 'key'], {
      indexName: 'plugin_data_board_unique',
      // [why] Using partial uniqueness via WHERE would need raw SQL;
      // board_id NULL is treated as a separate namespace (legacy only).
    });
  });

  // Add index for common lookup pattern
  await knex.schema.alterTable('plugin_data', (table) => {
    table.index(['plugin_id', 'board_id', 'scope', 'resource_id'], 'plugin_data_board_lookup_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plugin_data', (table) => {
    table.dropIndex([], 'plugin_data_board_lookup_idx');
    table.dropUnique([], 'plugin_data_board_unique');
    table.dropColumn('board_id');
  });

  await knex.schema.alterTable('plugin_data', (table) => {
    table.unique(['plugin_id', 'scope', 'resource_id', 'user_id', 'key']);
  });
}
```

---

### 2. Server — GET endpoint: use `board_id` in query + validate resource ownership

**File:** `server/extensions/plugins/api/plugin-data/get.ts`

#### Changes

1. Extract `boardId` from query params (already received but ignored).
2. Require `boardId` — return `400 missing-param` if absent.
3. Add `board_id: boardId` to the `where` clause.
4. For `scope='card'` or `scope='list'`, validate that the `resourceId` actually belongs to the `boardId` before reading (see §4 for the validation helper).

```typescript
// After existing resourceId checks:
if (!boardId) {
  return Response.json(
    { name: 'missing-param', data: { message: 'boardId is required' } },
    { status: 400 },
  );
}

// Validate resource belongs to this board (card and list scopes)
if (scope === 'card' || scope === 'list') {
  const valid = await validateResourceBelongsToBoard({ scope, resourceId, boardId });
  if (!valid) {
    return Response.json(
      { name: 'resource-board-mismatch', data: { message: 'resource does not belong to this board' } },
      { status: 403 },
    );
  }
}

const query = db('plugin_data').where({
  plugin_id: plugin.id,
  board_id: boardId,      // ← new
  scope,
  resource_id: resourceId,
  key,
});
```

---

### 3. Server — SET endpoint: use `board_id` in upsert + validate resource ownership

**File:** `server/extensions/plugins/api/plugin-data/set.ts`

Same changes as GET:

1. Require `boardId` in the body.
2. Validate resource belongs to board for `scope='card'/'list'`.
3. Include `board_id: boardId` in both the `where` clause (existing row check) and the `insert` payload.

```typescript
// Insert shape (NEW):
await db('plugin_data').insert({
  id: randomUUID(),
  plugin_id: plugin.id,
  board_id: boardId,           // ← new
  scope: scope as string,
  resource_id: resourceId,
  user_id: resolvedUserId,
  key,
  value: JSON.stringify(value),
});
```

---

### 4. Server — resource-board validation helper

**File:** `server/extensions/plugins/common/validateResourceBelongsToBoard.ts`

```typescript
interface Options {
  scope: 'card' | 'list';
  resourceId: string;
  boardId: string;
}

export async function validateResourceBelongsToBoard({ scope, resourceId, boardId }: Options): Promise<boolean> {
  if (scope === 'card') {
    const card = await db('cards').where({ id: resourceId }).first('list_id');
    if (!card) return false;
    const list = await db('lists').where({ id: card.list_id }).first('board_id');
    return list?.board_id === boardId;
  }

  if (scope === 'list') {
    const list = await db('lists').where({ id: resourceId }).first('board_id');
    return list?.board_id === boardId;
  }

  return true; // board and member scopes don't need extra lookup
}
```

---

### 5. Host bridge — always pass `boardId` in DATA_GET / DATA_SET

**File:** `src/extensions/Plugins/iframeHost/usePluginBridge.ts`

The `boardId` is already available as a hook parameter. The bridge already passes it in the API client call. No change needed here — but after this sprint, the server will **require** it, so any missing `boardId` in the bridge call would surface as a 400 error. Verify the bridge always passes `boardId`:

```typescript
const params = new URLSearchParams({
  scope,
  key,
  visibility,
  pluginId: bp.plugin.id,
  boardId,          // ← already present — confirm not accidentally dropped
});
if (resourceId) params.set('resourceId', resourceId);
```

Also confirm that `resourceId` from Sprint 37's fix is present (the bridge extracts it from `msg.payload.resourceId`).

---

### 6. SDK — inject `boardId` into `DATA_GET` / `DATA_SET` context

**File:** `server/extensions/plugins/sdk/jh-instance.ts`

After Sprint 37, `t.get()` already includes `resourceId` from `this.args[scope].id`. Ensure `boardId` is also forwarded so the bridge can pass it to the server:

```typescript
get(scope: Scope, visibility: Visibility, key: string): Promise<unknown> {
  const contextObj = (this.args[scope] ?? {}) as Record<string, unknown>;
  const resourceId = (contextObj['id'] as string | undefined) ?? null;
  // [why] boardId is always injected into args.board by the bridge at CAPABILITY_INVOKE time.
  const boardId = ((this.args['board'] ?? {}) as Record<string, unknown>)['id'] as string | undefined ?? null;
  return sendToHost('DATA_GET', { scope, visibility, key, resourceId, boardId });
}
```

Same for `set()`.

**Rebuild `public/sdk/jh-instance.js`** after changes.

---

## Data Model After This Sprint

```
plugin_data
├── id
├── plugin_id       → scoped per plugin ✅
├── board_id        → scoped per board  ✅ (NEW)
├── scope           → 'card' | 'list' | 'board' | 'member'
├── resource_id     → cardId / listId / boardId / userId
├── user_id         → NULL for shared, userId for private
├── key
└── value (jsonb)

UNIQUE: (plugin_id, board_id, scope, resource_id, user_id, key)
```

### Isolation guarantees

| Scope | resource_id | board-isolated by | Notes |
|---|---|---|---|
| `card` | cardId | `board_id` column + ownership check | Card UUIDs globally unique — double protection |
| `list` | listId | `board_id` column + ownership check | Same as card |
| `board` | boardId | `board_id` column (= resource_id) | Both columns contain the same boardId |
| `member` | userId | `board_id` column | **Only fixed in this sprint** — was previously global |

---

## Error Table

| Name | Status | When |
|---|---|---|
| `missing-param` (boardId) | 400 | `boardId` absent from request |
| `resource-board-mismatch` | 403 | card/list resourceId does not belong to the given board |
| `invalid-api-key` | 401 | Plugin API key invalid or inactive (unchanged) |

---

## Acceptance Criteria

1. Storing `t.set('card', 'private', 'x', 1)` on board A cannot be read back via `t.get('card', 'private', 'x')` on board B, even with the same cardId and pluginId.
2. `t.set('member', 'private', 'configured', true)` on board A is isolated from board B — reading it on board B returns `null`.
3. Calling the GET/SET API without `boardId` returns `400 missing-param`.
4. Passing a cardId that belongs to a different board returns `403 resource-board-mismatch`.
5. Existing flows from Sprint 37 (badges, buttons, data read/write) continue to work end-to-end after the migration.
6. Migration `0022_plugin_data_board_id.ts` runs cleanly on an empty database and on a database with existing `plugin_data` rows.

---

## Files Affected

| File | Change |
|---|---|
| `db/migrations/0022_plugin_data_board_id.ts` | New migration — adds `board_id` column and updates unique constraint |
| `server/extensions/plugins/api/plugin-data/get.ts` | Require `boardId`, add to `where`, validate resource ownership |
| `server/extensions/plugins/api/plugin-data/set.ts` | Require `boardId`, add to `where` + `insert`, validate resource ownership |
| `server/extensions/plugins/common/validateResourceBelongsToBoard.ts` | New helper |
| `server/extensions/plugins/sdk/jh-instance.ts` | Pass `boardId` in `DATA_GET` / `DATA_SET` payload |
| `public/sdk/jh-instance.js` | Rebuilt bundle |

---

## Technical Notes

- `board_id` is nullable in the migration to allow zero-downtime deploy — existing rows get `NULL` and become unreachable by production queries (which require `board_id`). No backfill is needed; old data can be safely pruned by a future maintenance job.
- PostgreSQL `NULL != NULL` means the old unique constraint `(plugin_id, scope, resource_id, user_id, key)` required special handling for nullable `user_id`. The new constraint `(plugin_id, board_id, scope, resource_id, user_id, key)` inherits the same caveats — the manual select-then-insert logic in `set.ts` remains correct.
- The `validateResourceBelongsToBoard` helper adds 1–2 extra DB queries per data operation. For high-frequency badge polling this may be noticeable; consider caching the card→board lookup in a short-lived Map keyed by `(cardId, boardId)` per request.
