# Sprint 131 — Comment Threaded Replies: DB + API

> **Depends on:** Sprint 11 (Comments CRUD), Sprint 129 (optional — share migration sequence)
> **Status:** ⬜ Future

---

## Goal

Extend the comments data model to support one level of threaded replies (parent comment → reply comments). Replies share the same `comments` table, distinguished by a non-null `parent_id`. The API exposes a dedicated endpoint to fetch a comment's replies, and the card-comments list endpoint returns only top-level comments so existing consumers are unaffected.

---

## Scope

### 1. DB Migration — add `parent_id` to `comments`

File: `db/migrations/0017_comment_replies.ts`

```ts
exports.up = async (knex) => {
  await knex.schema.alterTable('comments', (t) => {
    t.uuid('parent_id').nullable().references('id').inTable('comments').onDelete('CASCADE');
    t.index(['parent_id'], 'idx_comments_parent_id');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('comments', (t) => {
    t.dropIndex(['parent_id'], 'idx_comments_parent_id');
    t.dropColumn('parent_id');
  });
};
```

Constraint: replies are exactly one level deep — the server enforces this by rejecting a `POST` where the supplied `parent_id` itself has a non-null `parent_id`.

---

### 2. Server — Update `GET /api/v1/cards/:cardId/comments` (list)

File: `server/extensions/comment/api/list.ts`

Filter to top-level comments only: add `.whereNull('parent_id')` to the existing query. Attach a `reply_count` integer per comment (a single join/subquery on the same table).

Response shape per comment:
```ts
{
  id, card_id, user_id, content, version, deleted, created_at, updated_at,
  parent_id: null,
  reply_count: number,   // new field
  reactions: ReactionSummary[],
  author_name, author_email, author_avatar_url
}
```

---

### 3. Server — `POST /api/v1/cards/:cardId/comments` — accept `parent_id`

File: `server/extensions/comment/api/create.ts`

Extend the request body schema:
```ts
{ content: string; idempotency_key?: string; parent_id?: string }
```

Validation:
1. If `parent_id` is supplied:
   a. Load the parent comment; confirm it belongs to the same `card_id`.
   b. Confirm `parent_comment.parent_id IS NULL` (one level only). If not, return `{ name: 'reply-depth-exceeded' }`.
2. Insert with `parent_id` set (null when omitted).

The `reply_count` of the parent comment is not updated here — it is computed dynamically by the list query.

---

### 4. Server — `GET /api/v1/comments/:commentId/replies`

File: `server/extensions/comment/api/replies/get.ts`

Returns all direct replies to a comment:

```
GET /api/v1/comments/:commentId/replies
```

Logic:
1. Authenticate; verify the calling user is a MEMBER of the board the comment's card belongs to.
2. `SELECT ... FROM comments WHERE parent_id = :commentId AND deleted = false ORDER BY created_at ASC`
3. Join `users` for `author_name`, `author_email`, `author_avatar_url`.
4. Join `comment_reactions` (same as list) to attach `reactions`.
5. Return `{ data: Reply[] }`.

Error shapes:
```ts
{ name: 'comment-not-found' }
{ name: 'not-a-board-member' }
```

---

### 5. Router wiring

File: `server/extensions/comment/api/index.ts`

```ts
import repliesRouter from './replies/get';

// Mount under the comment ID namespace
router.get('/:commentId/replies', repliesRouter);
```

Also update the main comment router to ensure the new route has auth middleware applied.

---

### 6. Real-time events

After a successful reply creation emit a board-scoped WS event:

```ts
{
  type: 'comment_reply_added';
  card_id: string;
  parent_comment_id: string;
  reply: CommentData;  // full reply object including author info
}
```

---

### 7. `Comment` type update (shared)

If there is a shared `CommentData` type in `server/extensions/comment/types.ts` or similar, add:
```ts
parent_id: string | null;
reply_count?: number;
```

---

## Files Affected

```
db/migrations/0017_comment_replies.ts                         (new)
server/extensions/comment/api/list.ts                         (modified — filter, reply_count)
server/extensions/comment/api/create.ts                       (modified — accept parent_id)
server/extensions/comment/api/replies/
  get.ts                                                       (new)
  index.ts                                                     (new — router)
server/extensions/comment/api/index.ts                        (modified — mount replies router)
server/extensions/comment/types.ts                            (modified if exists)
```

---

## Acceptance Criteria

- [ ] `GET /api/v1/cards/:cardId/comments` returns only top-level comments (no replies in list).
- [ ] Each top-level comment includes `reply_count`.
- [ ] `POST` with a valid `parent_id` creates a reply; the reply is NOT visible in the top-level list.
- [ ] `POST` with a `parent_id` that is itself a reply returns `422 reply-depth-exceeded`.
- [ ] `GET /api/v1/comments/:commentId/replies` returns the correct replies in ascending `created_at` order.
- [ ] Deleting a parent comment cascades to delete its replies (DB-level `ON DELETE CASCADE`).
- [ ] WS event `comment_reply_added` is broadcast to the board room.

---

## Tests

`tests/integration/comment-replies.test.ts` covering:
- Create a top-level comment then a reply to it.
- Verify top-level list excludes the reply; `reply_count` reflects it.
- Fetch replies list — reply appears.
- Attempt to reply to a reply — expect `reply-depth-exceeded`.
- Auth guard on replies endpoint.
