# Board Activity In-App Notifications — Server-Side Spec
## Sprint 73

### Overview

Verify that the server correctly produces in-app notification rows and WebSocket events
for `card.created`, `card.moved`, and `comment.created` (mapped to `card_commented`) board
activity events. Actor is never notified for their own actions. Preference guard is
respected: members who have disabled `in_app_enabled` for the relevant type do not
receive a notification row.

---

## Scenario 1 — card_created notification appears for non-actor board member

**Given** a workspace with two members: User A (actor) and User B  
**And** User B's notification preference for `card_created` has `in_app_enabled: true` (default)  
**When** User A creates a new card on a board in that workspace  
**Then** a `card.created` event is persisted  
**And** `handleBoardActivityNotification` is invoked with `actorId = User A`  
**And** a notification row is inserted in the `notifications` table with  
  - `user_id = User B`  
  - `type = 'card_created'`  
  - `source_type = 'board_activity'`  
  - `card_id` matching the created card  
  - `board_id` matching the board  
  - `actor_id = User A`  
  - `read = false`  
**And** a `notification_created` WS event is published to User B's channel  
**And** no notification row is inserted for User A

---

## Scenario 2 — card_moved notification appears for non-actor board member

**Given** a workspace with User A and User B  
**And** User B's preference for `card_moved` has `in_app_enabled: true` (default)  
**When** User A moves a card from list "To Do" to list "In Progress"  
**Then** a `card.moved` event is persisted  
**And** a notification row is inserted with `type = 'card_moved'` for User B  
**And** a `notification_created` WS event is published to User B  
**And** no notification row is created for User A

---

## Scenario 3 — card_commented notification appears for non-actor board member

**Given** a workspace with User A and User B  
**And** User B's preference for `card_commented` has `in_app_enabled: true` (default)  
**When** User A posts a comment on a card  
**Then** a `comment_added` event is persisted  
**And** a notification row is inserted with `type = 'card_commented'` for User B  
**And** a `notification_created` WS event is published to User B  
**And** no notification row is created for User A

---

## Scenario 4 — preference guard: in_app_enabled false → no notification

**Given** a workspace with User A and User B  
**And** User B's preference for `card_created` has `in_app_enabled: false`  
**When** User A creates a card  
**Then** no notification row is inserted for User B  
**And** no WS event is published to User B's channel  
**And** the mutation completes without error (fire-and-forget)

---

## Scenario 5 — actor is never notified for own actions

**Given** a workspace with only User A  
**When** User A creates a card  
**Then** no notification row is inserted for User A  
**And** no WS event is published to User A's channel

---

## Scenario 6 — type filter on GET /api/v1/notifications

**Given** User B has notifications of type `mention`, `card_created`, and `card_moved`  
**When** User B calls `GET /api/v1/notifications?type=card_created`  
**Then** the response contains only notifications with `type = 'card_created'`  
**And** `mention` and `card_moved` notifications are excluded

**When** User B calls `GET /api/v1/notifications?type=mention`  
**Then** the response contains only notifications with `type = 'mention'`

**When** User B calls `GET /api/v1/notifications` (no type param)  
**Then** the response contains all notification types (backward compatible)

**When** User B calls `GET /api/v1/notifications?type=invalid_type`  
**Then** the response returns all notifications (invalid type param is ignored gracefully)

---

## Scenario 7 — notification bell shows card_created notification

**Given** User B has a `card_created` in-app notification  
**When** User B opens the notification bell in the UI  
**Then** the notification item shows the card title and board name  
**And** clicking the notification navigates to the card URL

---

## Scenario 8 — dispatch failures never block mutations

**Given** the DB insert for the notification row fails (e.g. DB unreachable)  
**When** User A creates a card  
**Then** the card creation API returns 200/201 successfully  
**And** no error is surfaced to User A  
**And** the failure is logged via `console.warn`

---

## Scenario 9 — NOTIFICATION_PREFERENCES_ENABLED=false → treat all channels as enabled

**Given** `NOTIFICATION_PREFERENCES_ENABLED` env var is `false`  
**And** User B has no preference row for `card_created`  
**When** User A creates a card  
**Then** a notification row is inserted for User B (opt-out model defaults to enabled)  
**And** a WS event is published to User B
