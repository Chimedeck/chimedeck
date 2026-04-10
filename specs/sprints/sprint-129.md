# Sprint 129 — Comment Emoji Reactions: DB + API

> **Depends on:** Sprint 11 (Comments CRUD)
> **Status:** ⬜ Future

---

## Goal

Add emoji reaction support to comments at the data and API layer. Any workspace member can react to a comment with any emoji; reacting again with the same emoji toggles the reaction off. Reaction counts are included in every comment response so the UI can render them without an extra round-trip.

---

## Scope

### 1. DB Migration — `comment_reactions` table

File: `db/migrations/0016_comment_reactions.ts`

```ts
exports.up = async (knex) => {
  await knex.schema.createTable('comment_reactions', (t) => {
    t.uuid('id').primary();
    t.uuid('comment_id').notNullable().references('id').inTable('comments').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('emoji', 32).notNullable();   // native emoji character, e.g. "👍"
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['comment_id', 'user_id', 'emoji']);
  });
  await knex.schema.alterTable('comment_reactions', (t) => {
    t.index(['comment_id'], 'idx_comment_reactions_comment_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('comment_reactions');
};
```

Constraint: one row per `(comment_id, user_id, emoji)` — the unique index enforces the toggle semantic on the server.

---

### 2. Server — Reaction API routes

Mount under `server/extensions/comment/api/reactions/`:

```
server/extensions/comment/api/reactions/
  add.ts      # POST   /api/v1/comments/:commentId/reactions
  remove.ts   # DELETE /api/v1/comments/:commentId/reactions/:emoji
  index.ts    # router wiring
```

#### `POST /api/v1/comments/:commentId/reactions`

Body: `{ emoji: string }` (must be a non-empty string ≤ 32 chars).

Logic:
1. Authenticate caller; resolve `user_id`.
2. Load comment; verify it belongs to a card on a board the caller is a MEMBER of.
3. Validate `emoji` is a non-empty string (no emoji-set whitelist — client controls the picker).
4. Upsert into `comment_reactions` (ignore conflict on the unique key — idempotent add).
5. Return `200` with `{ data: { comment_id, emoji, user_id } }`.

#### `DELETE /api/v1/comments/:commentId/reactions/:emoji`

`:emoji` is the URL-encoded native emoji character (e.g. `%F0%9F%91%8D` for 👍).

Logic:
1. Authenticate caller.
2. Delete the row where `comment_id = :commentId AND user_id = caller AND emoji = :emoji`.
3. If no row existed, still return `200` (idempotent).
4. Return `200` with `{ data: {} }`.

Error shapes follow the project convention:
```ts
{ name: 'comment-not-found' }
{ name: 'not-a-board-member' }
{ name: 'reaction-emoji-invalid' }
```

---

### 3. Extend comment list response to include reaction summaries

Modify `server/extensions/comment/api/list.ts` to join `comment_reactions` and attach a `reactions` field to every comment row:

```ts
// Shape of each reaction group
interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;  // true when caller's user_id is in the group
}
```

Query pattern (single extra query, not N+1):

```ts
const reactionRows = await trx('comment_reactions')
  .whereIn('comment_id', commentIds)
  .select('comment_id', 'emoji', 'user_id');

// Group in-process: Map<commentId, Map<emoji, { count, meReacted }>>
```

Attach the grouped `reactions: ReactionSummary[]` array to each comment in the list response, sorted by `count DESC`.

---

### 4. Router wiring

Update `server/extensions/comment/api/index.ts` to mount reactions sub-router:

```ts
import reactionsRouter from './reactions/index';

// inside commentRouter:
router.use('/:commentId/reactions', reactionsRouter);
```

---

### 5. Real-time events

Emit a `comment_reaction_added` / `comment_reaction_removed` board-scoped WebSocket event after each successful reaction toggle. Payload:

```ts
{
  type: 'comment_reaction_added' | 'comment_reaction_removed';
  card_id: string;
  comment_id: string;
  emoji: string;
  user_id: string;
}
```

Use the existing `broadcastBoardEvent` helper from `server/mods/realtime/`.

---

## Files Affected

```
db/migrations/0016_comment_reactions.ts         (new)
server/extensions/comment/api/reactions/
  index.ts                                       (new)
  add.ts                                         (new)
  remove.ts                                      (new)
server/extensions/comment/api/list.ts            (modified — add reactions join)
server/extensions/comment/api/index.ts           (modified — mount reactions router)
```

---

## Acceptance Criteria

- [ ] `POST /api/v1/comments/:id/reactions` with `{ emoji: "👍" }` inserts a row and returns 200.
- [ ] Repeating the same POST is idempotent (no error, no duplicate row).
- [ ] `DELETE /api/v1/comments/:id/reactions/%F0%9F%91%8D` removes the row.
- [ ] `GET /api/v1/cards/:cardId/comments` includes `reactions` on every comment; `reactedByMe` is `true` only for the calling user's own reactions.
- [ ] Caller not in the workspace receives `403 not-a-board-member`.
- [ ] WS event is emitted to board room on add and remove.

---

## Tests

`tests/integration/comment-reactions.test.ts` covering:
- Add reaction — happy path
- Add reaction — duplicate is idempotent
- Remove reaction — happy path
- Remove reaction — non-existent is idempotent
- List comments — reactions shape matches `ReactionSummary[]`
- Auth guard — unauthenticated caller receives 401
