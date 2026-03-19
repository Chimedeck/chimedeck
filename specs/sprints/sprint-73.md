# Sprint 73 — In-App Notifications for Board Activity

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 70 (Notification Preferences DB + API), Sprint 26 (Mention Notifications), Sprint 09 (Real-Time Infrastructure), Sprint 72 (Email Notifications — introduces `boardActivityDispatch.ts`)

---

## Goal

Extend the in-app notification system (Sprint 26) beyond `@mention` to cover board-level activity: **card created**, **card moved**, and **card commented**. When these events occur, all board members (except the actor) who have `in_app_enabled: true` for the relevant type receive a real-time WS notification and a persistent row in the `notifications` table. The existing notification bell and panel (Sprint 26 UI) display these alongside mention notifications with appropriate icons and copy.

---

## Scope

### 1. Extend `notifications` Table — New Types

No migration needed for the table schema itself — the `type` column is already `TEXT NOT NULL` (Sprint 26). The new valid values to support are:

```
'card_created' | 'card_moved' | 'card_commented'
```

Update the `type` check constraint if one exists, otherwise document valid values in a comment migration:

**`db/migrations/0032_notification_types_extend.ts`** — add comment / update constraint if applicable.

---

### 2. Board Activity In-App Dispatch

**`server/extensions/notifications/mods/boardActivityDispatch.ts`** (introduced in Sprint 72) is extended to handle the in-app channel alongside email:

```ts
// For each board member (excluding actor):
const pref = await getPreference({ userId: memberId, type: notificationType });
if (pref.in_app_enabled) {
  const notification = await db('notifications').insert({
    user_id: memberId,
    type: notificationType,
    source_type: sourceType,   // 'card' | 'comment'
    source_id: sourceId,
    card_id: cardId,
    board_id: boardId,
    actor_id: actorId,
    read: false,
  }).returning('*');

  await pubsub.publish(`user:${memberId}`, {
    type: 'notification_created',
    payload: { notification: { ...notification, actor } },
  });
}
```

This mirrors the mention dispatch from Sprint 26 — the WS event shape is identical, only the `type` field changes.

---

### 3. Event Hooks in `server/extensions/events/dispatch.ts`

After an event is persisted, call `handleBoardActivityNotification()` for the following event types:

| Event type | `notificationType` | `sourceType` |
|---|---|---|
| `card.created` | `card_created` | `card` |
| `card.moved` | `card_moved` | `card` |
| `comment.created` | `card_commented` | `comment` |

The call is **fire-and-forget** inside an async `try/catch` — a failing notification never blocks the originating mutation.

---

### 4. Client — Extend Notification Bell & Panel

**`src/extensions/Notifications/`**

#### 4a. Notification type icons

Add icons for the 3 new types in the notification panel item renderer:

| Type | Heroicon |
|---|---|
| `card_created` | `RectangleStackIcon` (outline) |
| `card_moved` | `ArrowRightIcon` (outline) |
| `card_commented` | `ChatBubbleLeftEllipsisIcon` (outline) |
| `mention` | `AtSymbolIcon` (outline, existing) |

#### 4b. Notification copy

| Type | Panel item text |
|---|---|
| `card_created` | **{actorName}** created **{cardTitle}** in **{boardName}** |
| `card_moved` | **{actorName}** moved **{cardTitle}** to **{listName}** |
| `card_commented` | **{actorName}** commented on **{cardTitle}** |
| `mention` | **{actorName}** mentioned you in **{cardTitle}** (existing) |

All items link to the card detail modal (`/boards/{boardId}/cards/{cardId}`).

#### 4c. WS handler

Extend `src/extensions/Notifications/hooks/useNotifications.ts` (Sprint 26) to accept the new `type` values and append them to the Redux notification list via the existing reducer.

---

### 5. API — `GET /api/v1/notifications` filter

Accept an optional `type` query param so clients can filter by type:

```
GET /api/v1/notifications?type=card_created
GET /api/v1/notifications?type=mention,card_commented
```

Comma-separated values map to a SQL `WHERE type = ANY(?)` clause.

---

### 6. Integration Tests

**`tests/integration/notifications/boardActivityNotifications.test.ts`**

| Scenario | Expected |
|---|---|
| Card created, board has 3 members, actor is one of them | 2 in-app notifications created, 2 WS events published |
| Actor has `in_app_enabled: false` for `card_created` | Notification NOT created for actor (would be 0 — actor excluded anyway) |
| Non-actor member has `in_app_enabled: false` for `card_moved` | That member receives no notification; others do |
| `card_commented` event | Notifications for all members except commenter |
| Notification dispatch throws | Mutation completes successfully, error logged |

---

## Files

| Path | Change |
|---|---|
| `db/migrations/0032_notification_types_extend.ts` | New — extend type constraint / add comment |
| `server/extensions/notifications/mods/boardActivityDispatch.ts` | Extend in-app channel (Sprint 72 added email) |
| `server/extensions/events/dispatch.ts` | Hook `card.created`, `card.moved`, `comment.created` events |
| `server/extensions/notifications/api/list.ts` | Add `type` filter to query |
| `src/extensions/Notifications/components/NotificationItem.tsx` | New icons + copy for 3 new types |
| `src/extensions/Notifications/hooks/useNotifications.ts` | Accept new WS payload types |
| `tests/integration/notifications/boardActivityNotifications.test.ts` | New |

---

## Acceptance Criteria

- [ ] Card created in a board → all other board members receive in-app notification + WS push
- [ ] Card moved → all other board members receive in-app notification + WS push
- [ ] Comment posted → all other board members receive in-app notification + WS push
- [ ] Member with `in_app_enabled: false` for the relevant type receives no notification
- [ ] Notification panel displays correct icon and copy for each of the 4 types
- [ ] `GET /api/v1/notifications?type=card_created` returns only that type
- [ ] Notification dispatch failures are fire-and-forget — mutations are never blocked
