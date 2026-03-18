# Sprint 88 - Expanded Card Activity Tracking (Create, Move, Assign)

> **Status:** Future sprint - not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 7 (Card Core), Sprint 11 (Comments & Activity Log), Sprint 29 (Configurable Events in Activity Feed), Sprint 73 (In-App Notifications for Board Activity)
> **References:** [requirements.md](../architecture/requirements.md)

---

## Goal

Add more card activity tracking so board members can see when cards are created, moved between lists, and assigned/unassigned.

This sprint delivers:
- New activity events for card create/move/assign actions
- Consistent activity payloads for card feed rendering
- Real-time propagation to open card activity views

---

## Scope

### 1. Server Event Emission

Emit immutable activity records for:
- `card_created`
- `card_moved`
- `card_member_assigned`
- `card_member_unassigned`

Each event must include:
- `actor_user_id`
- `card_id`
- `board_id`
- Event-specific metadata (from-list/to-list, assigned member id, etc.)
- Timestamp and stable event id

### 2. Activity Feed Query Integration

Ensure card activity API includes these new event types in feed response without breaking existing comment + event merge logic.

### 3. Client Activity Rendering

Add human-readable copy in activity feed, for example:
- `Tam created this card`
- `Tam moved this card from To Do to Doing`
- `Tam assigned Alex to this card`
- `Tam removed Alex from this card`

### 4. Real-Time Update Path

When events are created:
- Push updates via existing board/card real-time channel
- Open card modals receive new activity rows without refresh

### 5. Notification Hookup

Wire new activity events to notification fan-out rules where enabled by user preferences.

---

## File Checklist

| File | Change |
|------|--------|
| `server/extensions/card/api/create.ts` | Emit `card_created` activity |
| `server/extensions/card/api/patch.ts` | Emit `card_moved` and assignment activity events |
| `server/extensions/activity/mods/createActivityEvent.ts` | Extend event types and payload builder |
| `server/extensions/activity/api/getCardActivity.ts` | Include new event types in card feed query |
| `src/extensions/Card/containers/CardModal/ActivityFeed.tsx` | Render new activity message variants |
| `src/extensions/Notifications/mods/mapActivityToNotification.ts` | Optional notification mapping for new events |
| `specs/tests/card-activity-create-move-assign.md` | Manual + integration scenarios |

---

## Acceptance Criteria

- [ ] Creating a card produces a `card_created` activity item
- [ ] Moving a card between lists produces a `card_moved` activity item with from/to list names
- [ ] Assigning a member produces `card_member_assigned` activity item
- [ ] Unassigning a member produces `card_member_unassigned` activity item
- [ ] Activity appears in open card modal in real time without page reload
- [ ] Existing comment/activity ordering remains stable

---

## Tests

```text
specs/tests/card-activity-create-move-assign.md
```
