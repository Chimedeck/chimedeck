# Sprint 11 — Comments & Activity Log

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §§5.7, 2.3](../architecture/requirements.md), [event_sourcing.md](../architecture/event_sourcing.md), [technical-decisions.md §§3, 9](../architecture/technical-decisions.md)

---

## Goal

Deliver threaded comments on cards (editable, soft-deleted, versioned) and an immutable append-only activity log that records every mutation across the system.

---

## Scope

### 1. Data Model

Per [requirements §7](../architecture/requirements.md):

```prisma
model Comment {
  id        String   @id @default(cuid())
  cardId    String
  userId    String
  content   String   @db.Text   // markdown
  version   Int      @default(1)
  deleted   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  card      Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  user      User   @relation(fields: [userId], references: [id])
}

model Activity {
  id          String   @id @default(cuid())
  entityType  String   // "card" | "board" | "list" | "workspace"
  entityId    String
  boardId     String?  // indexed for board-level activity feed
  action      String   // e.g. "card_created", "card_moved", "comment_added"
  actorId     String
  payload     Json     // diff metadata (before/after for edits)
  createdAt   DateTime @default(now())

  @@index([entityId, createdAt])
  @@index([boardId, createdAt])
}
```

> `Activity` is **never** updated or deleted — only `INSERT` operations are allowed. Any attempt to `UPDATE` or `DELETE` an activity row must fail at the application layer; a DB trigger can enforce this as a safety net.

Migration: `0010_comments_activity`

### 2. Activity Backfill

Replace all stub `events/write.ts` calls from sprints 03–10 with real `Activity` row inserts as well. Both `Event` (sprint 09, for real-time) and `Activity` (this sprint, for audit log) are written in the same transaction.

### 3. Comment Versioning

Per [requirements §5.7](../architecture/requirements.md):

- Each `PATCH /api/v1/comments/:id` increments `version`
- Delete (`DELETE /api/v1/comments/:id`) sets `deleted: true` — content is replaced with `"[deleted]"` but the row remains
- API returns deleted comments as `{ id, deleted: true, content: "[deleted]", ... }`

### 4. Server Extension

```
server/extensions/comment/
  api/
    index.ts
    create.ts     # POST /api/v1/cards/:id/comments
    update.ts     # PATCH /api/v1/comments/:id  (own comment only)
    delete.ts     # DELETE /api/v1/comments/:id (own comment or ADMIN)

server/extensions/activity/
  api/
    cardActivity.ts    # GET /api/v1/cards/:id/activity
    boardActivity.ts   # GET /api/v1/boards/:id/activity
  mods/
    write.ts           # called by every mutation handler
```

### 5. API Routes

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| `POST` | `/api/v1/cards/:id/comments` | MEMBER | Add comment |
| `PATCH` | `/api/v1/comments/:id` | MEMBER (own) | Edit comment |
| `DELETE` | `/api/v1/comments/:id` | MEMBER (own) / ADMIN | Soft-delete |
| `GET` | `/api/v1/cards/:id/activity` | VIEWER | Card activity feed |
| `GET` | `/api/v1/boards/:id/activity` | VIEWER | Board activity feed (paginated) |

### 6. Pagination

Activity feeds use cursor-based pagination (per [technical-decisions.md §9](../architecture/technical-decisions.md)):

```
GET /api/v1/boards/:id/activity?cursor=<Activity.id>&limit=50
```

Response:
```ts
{
  data: Activity[],
  metadata: { cursor: string | null, hasMore: boolean }
}
```

### 7. Real-Time Events

New WS events after this sprint (per [event_sourcing.md](../architecture/event_sourcing.md)):

- `comment_added`
- `comment_edited`
- `comment_deleted`

Dispatched via sprint 09's `pubsub/publisher.ts`.

### 8. Frontend Extension

```
src/extensions/Comment/
  components/
    CommentThread.tsx       # list of comments
    CommentItem.tsx         # single comment with edit/delete
    CommentEditor.tsx       # markdown textarea
    CommentDeletedItem.tsx  # "[deleted]" placeholder

src/extensions/Activity/
  components/
    ActivityFeed.tsx        # timeline of activity events
    ActivityItem.tsx        # formatted event description
```

Activity items are human-readable descriptions generated on the client from `action` + `payload`:
- `card_moved` → "John moved **Fix bug** from Backlog to In Progress"
- `comment_added` → "Jane commented on **Design review**"

---

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `comment-not-found` | 404 | Invalid comment ID |
| `comment-not-owner` | 403 | Non-owner edit attempt (non-ADMIN) |
| `comment-deleted` | 409 | Editing a soft-deleted comment |

---

## Tests

- Unit: `activity/write.ts` ensures no UPDATE/DELETE calls hit Activity table, comment version increment
- Integration: full comment lifecycle (create → edit → soft-delete), board activity feed pagination, WS `comment_added` event received by subscribed clients

---

## Acceptance Criteria

- [ ] Every mutation since sprint 03 creates an `Activity` row
- [ ] `Activity` table rows can never be updated or deleted (application + DB enforced)
- [ ] Comment edit increments `version`
- [ ] Soft-deleted comment returns `deleted: true, content: "[deleted]"` — never `null` row
- [ ] Non-owner cannot edit another user's comment (403)
- [ ] ADMIN can soft-delete any comment
- [ ] Board activity feed returns paginated results with cursor
- [ ] WS `comment_added` event delivered to all board subscribers within 500 ms
