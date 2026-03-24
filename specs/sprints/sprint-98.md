# Sprint 98 — card_commented Notification Dispatch

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 72 (Email Notifications), Sprint 73 (In-App Notifications for Board Activity), Sprint 11 (Comments)

---

## Goal

The `card_commented` notification type exists in the DB schema and preference system (Sprint 70/71/72/73), but **comment creation does not currently trigger a notification dispatch**. This sprint wires the missing link: when a user posts a comment on a card, all board members (excluding the commenter) receive:

1. An **in-app notification** via the existing notification pipeline + WebSocket push
2. An **email notification** via SES (when `EMAIL_NOTIFICATIONS_ENABLED` is on and the recipient has not opted out)

This is the "User comment notification" gap identified in the product requirements.

---

## Acceptance Criteria

- [ ] Posting a comment on a card creates `card_commented` notifications for all board members except the commenter
- [ ] In-app notifications appear in the notification bell/panel in real time (WS push)
- [ ] Email is sent via SES for recipients who have `email_enabled = true` for `card_commented` and both email flags on
- [ ] Users who have opted out of `card_commented` notifications (in-app or email) receive nothing for that channel
- [ ] Board-level notification opt-out (Sprint 95) is respected
- [ ] Global notification opt-out (Sprint 95) is respected
- [ ] Comment author never receives their own notification
- [ ] Notification copy and navigation link point to the card

---

## Scope

### 1. Server — Comment creation hook

**File:** `server/extensions/comment/api/create.ts` (or the POST comments handler)

After the comment row is successfully inserted, fire dispatch as a **non-blocking side effect**:

```ts
// [why] Fire-and-forget — notification failure must never block comment creation.
boardActivityDispatch({
  type: 'card_commented',
  actorId: currentUserId,
  cardId: card.id,
  boardId: card.board_id,
  payload: {
    cardTitle: card.title,
    commentPreview: truncate(comment.body, 120), // strip markdown, max 120 chars
    commentId: comment.id,
  },
}).catch((err) => logger.warn({ err }, 'card_commented dispatch failed'));
```

`truncate` strips HTML/Markdown tags before slicing to avoid broken partial tags appearing in notification copy.

---

### 2. Server — `boardActivityDispatch` payload

Extend the payload union in `server/extensions/notifications/mods/boardActivityDispatch.ts` to include the comment-specific fields if not already present:

```ts
| {
    type: 'card_commented';
    cardTitle: string;
    commentPreview: string; // max 120 chars, markdown-stripped
    commentId: string;
  }
```

The dispatch function stores `commentId` in `notifications.source_id` so the notification panel can surface a direct anchor link (e.g. `/boards/{boardId}/cards/{cardId}#comment-{commentId}`).

---

### 3. Server — Email dispatch for card_commented

The `card_commented` SES template was defined in Sprint 72 (`emailTemplates/cardCommented.ts`). Verify it is called from `emailDispatch.ts` when `type === 'card_commented'`. If the template call is missing or stubbed, implement the wiring:

```ts
case 'card_commented':
  return renderCardCommentedEmail({
    actorName,
    cardTitle: data.cardTitle,
    boardName: data.boardName,
    commentPreview: data.commentPreview,
    cardUrl: buildCardUrl({ boardId: data.boardId, cardId: data.cardId }),
  });
```

---

### 4. Client — `NotificationItem.tsx` display for `card_commented`

Verify (or add) that `card_commented` notifications render with:

- **Icon:** `ChatBubbleLeftIcon` (Heroicons 24/outline), indigo accent
- **Copy:** `{actorName} commented on "{cardTitle}"`
- **Navigation:** clicking navigates `onNavigate` to `/boards/{boardId}/cards/{cardId}` (the comment anchor is a bonus; base card URL is sufficient)

If the notification already handles this type (from Sprint 73), no client changes needed — just verify.

---

### 5. Client — `mapActivityToNotification.ts`

Ensure `card_commented` is in `ACTION_TO_NOTIFICATION_TYPE` map and `buildCopy` returns:

```ts
case 'card_commented':
  return `${actorName} commented on "${payload.cardTitle}"`;
```

---

### 6. Comment notification self-exclusion

The existing `boardActivityDispatch` already excludes the `actorId` from recipients when filtering board members. Confirm this exclusion is in place for `card_commented` by auditing the dispatch function's `WHERE user_id != actorId` clause.

---

## File Checklist

| File | Change |
|------|--------|
| `server/extensions/comment/api/create.ts` | Add fire-and-forget `boardActivityDispatch` after insert |
| `server/extensions/notifications/mods/boardActivityDispatch.ts` | Extend payload union with `commentPreview` + `commentId` fields |
| `server/extensions/notifications/mods/emailDispatch.ts` | Verify/add `card_commented` case in template selector |
| `src/extensions/Notification/components/NotificationItem.tsx` | Verify `card_commented` icon + copy (add if missing) |
| `src/extensions/Notifications/mods/mapActivityToNotification.ts` | Verify `card_commented` copy builder (add if missing) |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | User A posts comment on card in board with 3 members | 2 `card_commented` notifications created (all except User A) |
| T2 | Recipient has `card_commented` in-app disabled | No in-app notification created for that recipient |
| T3 | Recipient has `card_commented` email disabled | No email sent for that recipient |
| T4 | Recipient has global notifications disabled (Sprint 95) | Both channels skipped |
| T5 | Recipient has board notifications disabled (Sprint 95) | Both channels skipped |
| T6 | WS push | Recipient's notification bell increments in real-time |
| T7 | Click notification | Navigates to the commented card |
