# Sprint 97 — New Notification Types: card_updated, card_deleted, card_archived

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 73 (In-App Notifications for Board Activity), Sprint 88 (Expanded Card Activity Tracking), Sprint 96 (Notifications Tab)

---

## Goal

The notification system currently covers `mention`, `card_created`, `card_moved`, `card_commented`, `card_member_assigned`, `card_member_unassigned`. Three lifecycle events important to board members are missing:

| Type | Trigger |
|------|---------|
| `card_updated` | Any field change on a card (title, description, labels, due date, cover, etc.) |
| `card_deleted` | A card is permanently deleted |
| `card_archived` | A card is archived or unarchived |

This sprint adds these three types end-to-end: DB constraint, server dispatch, client display, and preference panel.

---

## Acceptance Criteria

- [ ] DB CHECK constraint on `notifications.type` and `notification_preferences.type` accepts the three new values
- [ ] Each card mutation endpoint fires the corresponding notification to all board members (excluding the actor)
- [ ] New types are respected by the preference guard (opt-out model — enabled by default)
- [ ] `NotificationPreferencesPanel` shows all 9 types in the toggle matrix
- [ ] In-app notification panel renders a meaningful one-line copy for each new type
- [ ] WS `notification_created` event is pushed to affected recipients

---

## Scope

### 1. DB Migration `0091_notification_types_extend2.ts`

Drop and recreate the CHECK constraints on both `notifications` and `notification_preferences` tables to include the three new types.

```ts
const VALID_TYPES = [
  'mention',
  'card_created',
  'card_moved',
  'card_commented',
  'card_member_assigned',
  'card_member_unassigned',
  'card_updated',
  'card_deleted',
  'card_archived',
];
```

```ts
// Drop old CHECK constraint (named by Postgres), add new one.
await knex.raw(`
  ALTER TABLE notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check,
    ADD CONSTRAINT notifications_type_check CHECK (${CHECK_EXPR});
`);
await knex.raw(`
  ALTER TABLE notification_preferences
    DROP CONSTRAINT IF EXISTS notification_preferences_type_check,
    ADD CONSTRAINT notification_preferences_type_check CHECK (${CHECK_EXPR});
`);
```

---

### 2. Server — `NOTIFICATION_TYPES` constant

**`server/extensions/notifications/common/types.ts`** (or wherever the server-side constant is defined):

```ts
export const NOTIFICATION_TYPES = [
  'mention',
  'card_created',
  'card_moved',
  'card_commented',
  'card_member_assigned',
  'card_member_unassigned',
  'card_updated',
  'card_deleted',
  'card_archived',
] as const;
```

---

### 3. Server — Dispatch hooks

#### 3a. `card_updated` — fire on PATCH card

In `server/extensions/card/api/update.ts` (or the equivalent PATCH handler), after the card is persisted:

```ts
await boardActivityDispatch({
  type: 'card_updated',
  actorId: currentUserId,
  cardId: card.id,
  boardId: card.board_id,
  payload: {
    cardTitle: card.title,
    changedFields: Object.keys(patchBody), // list of field names that changed
  },
});
```

Only fire once per request regardless of how many fields changed. Do **not** fire when `archived` or `deleted` — those have their own types.

#### 3b. `card_deleted` — fire on DELETE card

In the card DELETE endpoint, **before** the row is removed (so we still have the card data):

```ts
await boardActivityDispatch({
  type: 'card_deleted',
  actorId: currentUserId,
  cardId: card.id,
  boardId: card.board_id,
  payload: { cardTitle: card.title },
});
```

Dispatch is fire-and-forget; failure does not abort the deletion.

#### 3c. `card_archived` — fire on archive/unarchive

In the card archive toggle endpoint:

```ts
await boardActivityDispatch({
  type: 'card_archived',
  actorId: currentUserId,
  cardId: card.id,
  boardId: card.board_id,
  payload: {
    cardTitle: card.title,
    archived: true | false, // pass the new archived state
  },
});
```

---

### 4. Server — `boardActivityDispatch` payload types

Extend the payload union in `server/extensions/notifications/mods/boardActivityDispatch.ts`:

```ts
type NotificationPayload =
  | { type: 'card_updated'; changedFields: string[]; cardTitle: string }
  | { type: 'card_deleted'; cardTitle: string }
  | { type: 'card_archived'; cardTitle: string; archived: boolean }
  | /* ... existing types ... */;
```

---

### 5. Client — `types.ts`

**`src/extensions/Notifications/NotificationPreferences/types.ts`**

```ts
export const NOTIFICATION_TYPES = [
  'mention',
  'card_created',
  'card_moved',
  'card_commented',
  'card_member_assigned',
  'card_member_unassigned',
  'card_updated',
  'card_deleted',
  'card_archived',
] as const;

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  // ... existing
  card_updated: 'Card updated',
  card_deleted: 'Card deleted',
  card_archived: 'Card archived',
};
```

Also update **`src/extensions/Notification/api/index.ts`** `NotificationType` union to include the 3 new values.

---

### 6. Client — `mapActivityToNotification.ts`

Extend `ACTION_TO_NOTIFICATION_TYPE` and the `buildCopy` function to produce human-readable copy:

| Type | Copy |
|------|------|
| `card_updated` | `{actorName} updated "{cardTitle}"` |
| `card_deleted` | `{actorName} deleted "{cardTitle}"` |
| `card_archived` | `{actorName} archived "{cardTitle}"` / `{actorName} unarchived "{cardTitle}"` |

---

### 7. Client — `NotificationItem.tsx`

Add icon + colour mappings for the three new types:

| Type | Icon (Heroicons 24/outline) | Accent |
|------|----------------------------|--------|
| `card_updated` | `PencilSquareIcon` | indigo |
| `card_deleted` | `TrashIcon` | red |
| `card_archived` | `ArchiveBoxIcon` | amber |

---

## File Checklist

| File | Change |
|------|--------|
| `db/migrations/0091_notification_types_extend2.ts` | New migration — extend CHECK constraints |
| `server/extensions/notifications/common/types.ts` | Add 3 new types to `NOTIFICATION_TYPES` |
| `server/extensions/notifications/mods/boardActivityDispatch.ts` | Extend payload union |
| `server/extensions/card/api/update.ts` | Dispatch `card_updated` after PATCH |
| `server/extensions/card/api/delete.ts` | Dispatch `card_deleted` before DELETE |
| `server/extensions/card/api/archive.ts` | Dispatch `card_archived` after archive toggle |
| `src/extensions/Notifications/NotificationPreferences/types.ts` | Add 3 new types + labels |
| `src/extensions/Notification/api/index.ts` | Extend `NotificationType` union |
| `src/extensions/Notifications/mods/mapActivityToNotification.ts` | Add copy builders |
| `src/extensions/Notification/components/NotificationItem.tsx` | Add icons/colours |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | PATCH a card's title | `card_updated` notification created for all board members except actor |
| T2 | DELETE a card | `card_deleted` notification dispatched before row removal |
| T3 | Archive a card | `card_archived` notification dispatched with `archived: true` |
| T4 | User disables `card_updated` in-app preference | No in-app notification created on next card update |
| T5 | DB insert with type `card_updated` | Accepted by CHECK constraint |
| T6 | DB insert with type `card_invalid` | Rejected by CHECK constraint |
| T7 | NotificationPreferencesPanel | All 9 types visible in toggle matrix |
