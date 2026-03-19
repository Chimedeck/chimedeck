# Card Activity Events: Create, Move, Assign / Unassign

> **Sprint:** 88
> **Feature:** Card activity event emission, feed rendering, realtime updates, and notification fan-out
> **Status:** Complete — all iterations implemented (event emission, feed query, UI rendering, realtime, notifications)

Playwright MCP scenario specifications for Sprint 88 card activity events.
These scenarios validate that the correct immutable activity records are emitted
and that payloads match the documented schema.

---

## Acceptance Checklist

- [x] `card_created` event emitted on `POST /api/v1/lists/:id/cards`
- [x] `card_created` payload includes `cardId`, `cardTitle`, `listId`, `boardId`, `workspaceId`
- [x] `card_moved` event emitted on `PATCH /api/v1/cards/:id/move` when list changes
- [x] No `card_moved` event emitted on same-list reorder
- [x] `card_moved` payload includes `fromListId`, `fromListName`, `toListId`, `toListName`
- [x] Cross-board move is rejected with 400 — no event written
- [x] `card_member_assigned` event emitted on `POST /api/v1/cards/:id/members`
- [x] Duplicate assign is idempotent — no duplicate `card_member_assigned` event
- [x] Assign of non-workspace user returns 400 — no event written
- [x] `card_member_unassigned` event emitted on `DELETE /api/v1/cards/:id/members/:userId`
- [x] Unassign of non-assigned member is a no-op — no event written
- [x] All events include `id` (UUID), `actor_id`, `action`, `created_at`, `payload.cardId`
- [x] Activity feed returns events ordered by `created_at DESC`, `id DESC` for determinism
- [x] Legacy event types remain visible alongside new event types in the feed
- [x] Activity feed filtered by `VISIBLE_EVENT_TYPES` allowlist
- [x] Activity feed accessible to all workspace members (VIEWER and above)
- [x] Activity feed returns 401 for unauthenticated requests
- [x] Event payloads are immutable after write — no API endpoint to mutate or delete activity rows
- [x] `card_created` rendered as "created this card" in card modal UI
- [x] `card_moved` rendered as "moved this card from X to Y" in card modal UI
- [x] `card_member_assigned` rendered as "assigned <name> to this card" in card modal UI
- [x] Self-assignment renders "assigned themselves to this card" — not the actor's own name
- [x] `card_member_unassigned` rendered as "removed <name> from this card"
- [x] Self-removal renders "removed themselves from this card"
- [x] Unknown/future event types filtered from the feed UI (not rendered, no JS error)
- [x] Member name falls back to "a member" when user is no longer on the board
- [x] New activity row appears in open card modal via realtime without page refresh
- [x] Realtime events scoped to the correct card — no cross-card leakage
- [x] No cross-board leakage in realtime activity delivery
- [x] Notification fan-out for all four event types via `mapActivityToNotification`
- [x] Notification fan-out respects per-user opt-out preferences
- [x] Self-actions do not generate self-notifications
- [x] `card_member_assigned` and `card_member_unassigned` email templates implemented

---

## Fixture Setup

Before each scenario, ensure:
- A workspace with at least two members: **Alice** (actor) and **Bob** (target).
- A board owned by the workspace with two lists: **"Backlog"** and **"In Progress"**.
- Alice is authenticated.

---

## 1. `card_created` — Event emitted on card creation

### 1.1 Happy path: event written with correct payload
1. Alice sends `POST /api/v1/lists/:backlogListId/cards` with `{ title: "New card" }`.
2. Assert response is `201` with a `data.id`.
3. Query `GET /api/v1/cards/:cardId/activity`.
4. Assert the feed contains exactly one event with:
   - `action = "card_created"`
   - `payload.cardId = <new card id>`
   - `payload.cardTitle = "New card"`
   - `payload.listId = <backlogListId>`
   - `actor_id = Alice.id`
5. Assert the event row has a stable UUID `id` and an immutable `created_at`.

### 1.2 Edge case: no duplicate on concurrent create with same title
1. Alice creates two cards with different titles back-to-back.
2. Assert each card produces exactly one `card_created` event — no cross-contamination.

---

## 2. `card_moved` — Event emitted when card changes list

### 2.1 Happy path: move from Backlog to In Progress
1. Alice creates a card in **Backlog** (`cardId`).
2. Alice sends `PATCH /api/v1/cards/:cardId/move` with `{ targetListId: <inProgressListId> }`.
3. Assert response is `200`.
4. Query `GET /api/v1/cards/:cardId/activity`.
5. Assert the feed contains a `card_moved` event with:
   - `action = "card_moved"`
   - `payload.cardId = <cardId>`
   - `payload.fromListId = <backlogListId>`
   - `payload.fromListName = "Backlog"`
   - `payload.toListId = <inProgressListId>`
   - `payload.toListName = "In Progress"`
   - `actor_id = Alice.id`

### 2.2 No event on same-list reorder
1. Alice creates two cards in **Backlog**: Card A and Card B.
2. Alice sends `PATCH /api/v1/cards/:cardAId/move` with `{ targetListId: <backlogListId>, afterCardId: <cardBId> }` (same list, reorder only).
3. Assert response is `200`.
4. Query `GET /api/v1/cards/:cardAId/activity`.
5. Assert **no** `card_moved` event is present for this operation (only `card_created` from step 1).

### 2.3 Edge case: cross-board move is rejected — no event written
1. Alice creates a second board with a list **"Other"**.
2. Alice sends `PATCH /api/v1/cards/:cardId/move` with `{ targetListId: <otherBoardListId> }`.
3. Assert response is `400` with `error.code = "cross-board-move"`.
4. Assert no new activity event is written for `cardId`.

---

## 3. `card_member_assigned` — Event emitted on member assignment

### 3.1 Happy path: assign Bob to a card
1. Alice creates a card in **Backlog** (`cardId`).
2. Alice sends `POST /api/v1/cards/:cardId/members` with `{ userId: Bob.id }`.
3. Assert response is `201`.
4. Query `GET /api/v1/cards/:cardId/activity`.
5. Assert the feed contains a `card_member_assigned` event with:
   - `action = "card_member_assigned"`
   - `payload.cardId = <cardId>`
   - `payload.userId = Bob.id`
   - `actor_id = Alice.id`

### 3.2 Idempotency: no duplicate event on repeated assign
1. Alice assigns Bob (step 3.1).
2. Alice sends `POST /api/v1/cards/:cardId/members` again with `{ userId: Bob.id }`.
3. Assert response is `200` (idempotent, not `201`).
4. Query `GET /api/v1/cards/:cardId/activity`.
5. Assert exactly **one** `card_member_assigned` event for Bob — no duplicate.

### 3.3 Error case: assign user not in workspace — no event written
1. Alice sends `POST /api/v1/cards/:cardId/members` with `{ userId: <outsiderUserId> }`.
2. Assert response is `400` with `error.code = "member-not-in-workspace"`.
3. Assert no `card_member_assigned` event is written.

---

## 4. `card_member_unassigned` — Event emitted on member removal

### 4.1 Happy path: remove Bob from a card
1. Alice creates a card and assigns Bob (from scenario 3.1).
2. Alice sends `DELETE /api/v1/cards/:cardId/members/:bobId`.
3. Assert response is `204`.
4. Query `GET /api/v1/cards/:cardId/activity`.
5. Assert the feed contains a `card_member_unassigned` event with:
   - `action = "card_member_unassigned"`
   - `payload.cardId = <cardId>`
   - `payload.userId = Bob.id`
   - `actor_id = Alice.id`

### 4.2 No event on remove of non-existent assignment
1. Alice sends `DELETE /api/v1/cards/:cardId/members/:bobId` where Bob was never assigned.
2. Assert response is `204` (idempotent delete).
3. Assert **no** `card_member_unassigned` event is written for this card.

---

## 5. Combined patch: move and assign in separate requests

### 5.1 Both events appear in feed in correct order
1. Alice creates a card in **Backlog**.
2. Alice moves the card to **In Progress**.
3. Alice assigns Bob to the card.
4. Query `GET /api/v1/cards/:cardId/activity`.
5. Assert the feed includes all three events in chronological order:
   - `card_created`
   - `card_moved`
   - `card_member_assigned`
6. Assert each event has a distinct `id` and `created_at` that is strictly non-decreasing.

---

## 6. Payload immutability and schema conformance

### 6.1 Events cannot be modified after write
1. Write any activity event (e.g., via card creation).
2. Attempt a direct `UPDATE` on the `activities` table row (simulate a rogue caller).
3. Assert the application layer never exposes an endpoint to mutate or delete activity rows.
4. Assert `GET /api/v1/cards/:cardId/activity` always returns the original payload.

### 6.2 All events include required fields
For each of `card_created`, `card_moved`, `card_member_assigned`, `card_member_unassigned`:
- Assert `id` is a non-empty UUID.
- Assert `action` matches the expected string.
- Assert `actor_id` matches the authenticated user's id.
- Assert `created_at` is a valid ISO 8601 timestamp.
- Assert `payload` is a non-null object with at minimum `cardId`.

---

## 7. Feed ordering stability — activity events merged with comments

### 7.1 Activity events appear before co-timestamp comments when IDs are lexicographically later

Background: the server applies a secondary `ORDER BY id DESC` so that events with identical
`created_at` values are returned in a stable, deterministic sequence.

1. Alice creates a card (`cardId`).
2. Alice posts a comment on the card via `POST /api/v1/cards/:cardId/comments`.
3. (Simulate timestamp collision by checking that both the `card_created` activity row and a
   synthetic activity row could share the same second — this is a unit-level concern; at the
   integration level, assert that the feed order is consistent across repeated calls.)
4. Call `GET /api/v1/cards/:cardId/activity` twice in succession.
5. Assert both responses return identical ordering — no flipping between calls.

### 7.2 Merged client feed: comments and events interleaved chronologically

1. Alice creates a card.
2. Alice posts comment C1 (`POST /api/v1/cards/:cardId/comments`).
3. Alice moves the card to **In Progress** (`PATCH /api/v1/cards/:cardId/move`).
4. Alice posts comment C2.
5. Alice assigns Bob to the card.
6. Fetch `GET /api/v1/cards/:cardId/activity` and `GET /api/v1/cards/:cardId/comments`.
7. Merge the two arrays client-side, sorted by `created_at` descending.
8. Assert the merged feed order (newest first) is:
   - `card_member_assigned` (most recent event)
   - C2 (most recent comment)
   - `card_moved`
   - C1
   - `card_created`
9. Assert no duplicate rows exist (unique `id` per item).

### 7.3 Legacy activity events remain visible alongside new event types

1. Alice performs a sequence that includes a legacy event (e.g., `card.member.added`) and a new
   event (`card_member_assigned`) for the same card.
2. Call `GET /api/v1/cards/:cardId/activity`.
3. Assert both `card.member.added` and `card_member_assigned` appear in the response.
4. Assert neither legacy nor new events are absent or duplicated.

### 7.4 Empty activity feed returns valid shape

1. A newly created card (no moves, assigns, or comments yet) should have exactly one event.
2. Call `GET /api/v1/cards/:cardId/activity` immediately after creation.
3. Assert response is `200` with `data` array of length 1 containing `card_created`.
4. Assert no error fields are present in the response body.

### 7.5 Feed is stable when two events share the exact same `created_at`

1. Insert two activity rows for the same card directly with identical `created_at` values
   (test-setup only; production rows from different actions will naturally differ).
2. Call `GET /api/v1/cards/:cardId/activity` three times.
3. Assert all three responses return the two rows in the same order every time (secondary `id`
   sort guarantees determinism).

---

## 8. Client UI — Activity feed message rendering

These scenarios verify the rendered copy inside the card modal activity feed for each new
event type. All scenarios use the Playwright MCP browser tool.

### Fixture Setup (UI)
- Alice is authenticated and a board with **Backlog** and **In Progress** lists is open.
- Bob is also a board member.

---

### 8.1 `card_created` — rendered as "created this card"

1. Alice creates a card titled **"Design spec"** in Backlog.
2. Open the card modal.
3. In the **Activity** section, assert exactly one system-event row is visible.
4. Assert the row reads: **Alice** · "created this card" · <relative timestamp>.
5. Assert the row does **not** display a comment bubble (no reply, no edit).

---

### 8.2 `card_moved` — rendered with list names

1. Alice creates a card in **Backlog** and opens the card modal.
2. Alice moves the card to **In Progress** (via the list-move action in the modal).
3. In the **Activity** section, assert a new event row appears at the top.
4. Assert the row reads: **Alice** · "moved this card from Backlog to In Progress".
5. Assert the row does **not** include a thumbnail or comment controls.

---

### 8.3 `card_moved` — no event row on same-list reorder

1. Alice creates two cards in **Backlog**: Card A and Card B.
2. Alice reorders Card A within Backlog (drag above Card B).
3. Open Card A's modal and inspect the Activity section.
4. Assert **no** "moved this card" row is present — only "created this card".

---

### 8.4 `card_member_assigned` — Alice assigns Bob

1. Alice creates a card and opens the card modal.
2. Alice assigns Bob to the card via the Members section.
3. In the **Activity** section, assert a new event row reads:
   **Alice** · "assigned Bob to this card".
4. Assert Bob's display name (from board member list) is used, not his user id.

---

### 8.5 `card_member_assigned` — self-assignment copy

1. Alice creates a card and opens the card modal.
2. Alice assigns herself to the card.
3. Assert the activity row reads: **Alice** · "assigned themselves to this card".
4. Assert it does **not** read "assigned Alice to this card" (no double name).

---

### 8.6 `card_member_unassigned` — Alice removes Bob

1. Alice creates a card, assigns Bob, then removes Bob via the Members section.
2. In the **Activity** section, assert a row reads:
   **Alice** · "removed Bob from this card".
3. Assert the earlier "assigned Bob to this card" row is still present below it.

---

### 8.7 `card_member_unassigned` — self-removal copy

1. Alice creates a card, assigns herself, then removes herself.
2. Assert the activity row reads: **Alice** · "removed themselves from this card".

---

### 8.8 Unknown event type — graceful fallback

1. Manually inject an activity row with `action = "future_unknown_event"` for a card
   (via direct DB insert in test setup).
2. Open the card modal.
3. Assert the row is rendered (not omitted) — since `future_unknown_event` will not be in
   the `VISIBLE_ACTIVITY_EVENT_TYPES` allowlist, it should be filtered out and **not** appear.
4. (Informational) Confirm no JS errors are thrown in the browser console.

---

### 8.9 Member name falls back gracefully when user is not in boardMembers

1. A card has a `card_member_assigned` event where `payload.userId` belongs to a user who
   has since left the board (no longer in `boardMembers`).
2. Open the card modal.
3. Assert the row renders without error and reads: **<actor>** · "assigned a member to this card".
4. Assert no blank or `undefined` text is displayed.

---

### 8.10 All four event types visible in combined chronological feed

1. Alice creates a card in Backlog.
2. Alice moves it to In Progress.
3. Alice assigns Bob.
4. Alice removes Bob.
5. Open the card modal Activity feed.
6. Assert all four event rows appear in descending timestamp order (newest first):
   - "removed Bob from this card"
   - "assigned Bob to this card"
   - "moved this card from Backlog to In Progress"
   - "created this card"
7. Assert each row has an avatar, actor name, descriptive label, and relative timestamp.
8. Assert no duplicate rows are present.

---

## Section 9 — Realtime activity feed updates (multi-session)

### 9.1 New activity row appears in open modal without refresh

**Setup:** Alice and Bob are both authenticated on the same board. Alice has the card modal open for Card X.

1. Bob moves Card X from **Backlog** to **In Progress** (without Alice's modal closing).
2. Assert that a `card_moved` activity row appears in Alice's open modal within 2 seconds.
3. Assert the row reads: **Bob** · "moved this card from Backlog to In Progress".
4. Assert Alice did **not** refresh the page or close/reopen the modal.

---

### 9.2 Self-action realtime row: actor sees own activity appear immediately

1. Alice opens the card modal for Card X.
2. Alice assigns herself to the card via the Members section.
3. Assert an activity row appears in Alice's own feed:
   **Alice** · "assigned themselves to this card".
4. Assert the row appears without a page reload.

---

### 9.3 Assignment event received by other open modal session

**Setup:** Alice has Card X modal open. Bob is viewing the same board (may or may not have the modal open).

1. Bob assigns himself to Card X.
2. Assert that Alice's open modal shows a new row: **Bob** · "assigned Bob to this card".
3. Assert no duplicate rows are present (not both from initial fetch and realtime delivery).

---

### 9.4 Realtime event for a different card is ignored

**Setup:** Alice has Card X modal open. Bob acts on Card Y (a different card on the same board).

1. Bob moves Card Y to **Done**.
2. Assert Alice's open modal for Card X does **not** gain any new activity rows.
3. Assert Card X's activity count remains unchanged.

---

### 9.5 Realtime delivery after reconnect

1. Alice opens the card modal for Card X.
2. Alice's WebSocket disconnects (simulate by disabling network briefly).
3. While disconnected, Bob creates a comment (triggers no `card_activity_created` event but confirms the connection lifecycle).
4. Bob also moves Card X to another list (emits a `card_activity_created` event for card_moved).
5. Alice's WebSocket reconnects.
6. Assert that after reconnect the missed `card_moved` activity row appears in the feed (via board event re-sync or realtime delivery on reconnect).

---

### 9.6 No cross-board leakage

**Setup:** Alice is viewing Board A with Card X's modal open. Bob acts on Card Z which lives on Board B.

1. Bob creates Card Z on Board B.
2. Assert Alice's open modal for Card X on Board A does **not** receive any new activity rows from Board B.

---

### 9.7 Concurrent comment + realtime activity — no duplicate or missing rows

1. Alice types a comment and submits it at the same time Bob moves the card to another list.
2. Assert Alice's feed shows both:
   - Her submitted comment (at the top or chronologically correct position).
   - Bob's `card_moved` activity row.
3. Assert no duplicate rows appear for either event.

---

## Section 10 — Notification mapping and fan-out

### 10.1 card_created activity triggers in-app notification for workspace members

**Setup:** Workspace W has members Alice, Bob, and Carol. Bob is authenticated and creates a card on a board owned by workspace W.

1. Bob creates **Card X** in list **To Do** on Board B.
2. Assert a `card_created` notification row is visible in Alice's notification panel.
3. Assert the notification copy reads: **Bob** · created "Card X" in Board B.
4. Assert Carol also receives the same notification.
5. Assert Bob does **not** receive a self-notification for his own card creation.

---

### 10.2 card_moved activity triggers in-app notification with destination list

**Setup:** Alice, Bob, and Carol are workspace members. Alice moves a card.

1. Alice moves **Card X** from list **Backlog** to list **In Progress**.
2. Assert Bob's notification panel shows a `card_moved` notification row.
3. Assert the copy reads: **Alice** · moved "Card X" to In Progress.
4. Assert Carol receives the same notification.
5. Assert Alice does **not** receive a self-notification.

---

### 10.3 card_member_assigned activity notifies the assigned user

**Setup:** Alice is a workspace member. Bob assigns Alice to Card X.

1. Bob assigns Alice to **Card X**.
2. Assert Alice's notification panel shows a `card_member_assigned` row.
3. Assert the copy reads: **Bob** · was assigned to "Card X" (or similar).
4. Assert Carol (another workspace member) also receives the notification.
5. Assert Bob does **not** receive a self-notification.

---

### 10.4 card_member_unassigned activity notifies the removed user

**Setup:** Alice is assigned to Card X. Bob removes Alice from the card.

1. Bob removes Alice from **Card X**.
2. Assert Alice's notification panel shows a `card_member_unassigned` row.
3. Assert the copy reads: **Bob** · was removed from "Card X" (or similar).
4. Assert Bob does **not** receive a self-notification.

---

### 10.5 Preference opt-out suppresses in-app notification

**Setup:** Bob has disabled in-app notifications for `card_created` (set `in_app_enabled = false`).

1. Alice creates **Card Y** on a board in workspace W.
2. Assert Alice's notification panel shows the `card_created` row.
3. Assert Bob's notification panel does **not** show a `card_created` row for Card Y.
4. Assert the notification row was not inserted into Bob's notifications in the DB.

---

### 10.6 Preference opt-out does not affect other notification types

**Setup:** Bob has disabled `card_created` in-app notifications but has `card_moved` enabled.

1. Alice moves **Card X** to list **Done**.
2. Assert Bob's notification panel **does** show the `card_moved` row.
3. Assert the row's copy correctly names the destination list.

---

### 10.7 Realtime delivery: notification appears without page refresh

**Setup:** Bob is authenticated with his notification panel open.

1. Alice creates **Card Z** on a board in workspace W (Bob is a member).
2. Assert Bob's open notification panel gains a new `card_created` row within 2 seconds.
3. Assert the unread count badge in the notification bell increments.
4. Assert Bob did **not** refresh the page.

---

### 10.8 Self-assignment notification — actor assigns themselves

**Setup:** Alice assigns herself to Card X.

1. Alice opens Card X and assigns herself via the Members section.
2. Assert Alice does **not** receive a `card_member_assigned` self-notification.
3. Assert other workspace members (Bob, Carol) do receive the `card_member_assigned` notification.

---

### 10.9 Edge: rapid successive assignments do not create duplicate notifications

**Setup:** Bob rapidly assigns and then unassigns Alice from Card X in quick succession.

1. Bob assigns Alice to Card X → `card_member_assigned` activity emitted.
2. Within 1 second, Bob unassigns Alice → `card_member_unassigned` activity emitted.
3. Assert Alice's notification panel shows exactly two rows: one assigned, one unassigned.
4. Assert no duplicate rows appear.

---

### 10.10 No cross-workspace notification leakage

**Setup:** Alice is a member of Workspace W1 only. Bob performs actions on a board in Workspace W2.

1. Bob creates a card, moves a card, and assigns a member in Workspace W2.
2. Assert Alice's notification panel receives **no** notification rows from Workspace W2.

---

## Section 11 — Regression and acceptance hardening

These scenarios were added in Sprint 88 Iteration 11 to cover edge cases and error paths
identified during final regression testing. They complement the happy-path scenarios above
and must all pass before Sprint 88 is considered closed.

---

### 11.1 Activity feed API error state — server returns 500

**Preconditions:** Alice has a card modal open. The server `/api/v1/cards/:id/activity` endpoint is intercepted to return 500.

1. Intercept `GET /api/v1/cards/:cardId/activity` to return HTTP 500.
2. Open the card modal for that card.
3. Assert the Activity section renders an error state (not a blank panel, not a spinner).
4. Assert no JavaScript exception is thrown in the browser console.
5. Remove the intercept and reload the modal.
6. Assert the activity feed renders correctly with the expected events.

---

### 11.2 Activity feed for card with many events does not truncate silently

**Preconditions:** A card has more than 50 activity rows (create, move, and assign events across multiple actors).

1. Call `GET /api/v1/cards/:cardId/activity`.
2. Assert the response returns all activity rows (or the documented page size with correct `metadata.hasMore`).
3. Assert the response shape matches `{ data: Array, metadata?: { ... } }`.
4. Assert no events are silently dropped or out of order.

> **Note:** If the current implementation does not paginate, assert that all rows are returned
> in a single response with `data.length` equal to the actual row count.

---

### 11.3 Card creation failure does not emit a stray activity event

**Preconditions:** A valid list exists.

1. `POST /api/v1/lists/:listId/cards` with `{}` (missing required `title` field).
2. Assert HTTP 400.
3. Count `card_created` activity rows for this list.
4. Assert the count has not increased — no partial or orphaned activity record was written.

---

### 11.4 Activity event write failure is non-blocking for card API response

**Preconditions:** The `writeActivity` DB call is intercepted at the integration-test level to simulate a transient DB error after the card has already been created.

> **Note:** This scenario is best validated at the unit/integration test level rather than
> via Playwright; it documents the requirement that the card API does not return an error
> solely because the activity write failed.

1. Card `POST` succeeds → returns 201 with `data.id`.
2. Activity write throws an error (simulated).
3. Assert the 201 response is still returned to the caller.
4. Assert no unhandled exception propagates back to the client.

---

### 11.5 VIEWER role can read activity feed

**Preconditions:** User Carol has VIEWER role in workspace W1. A card with activity events exists on a board in W1.

1. Carol authenticates and calls `GET /api/v1/cards/:cardId/activity`.
2. Assert HTTP 200 and `data` is a non-empty array containing the expected events.

---

### 11.6 Non-workspace member cannot read activity feed

**Preconditions:** User Dave is not a member of workspace W1. A card exists on a board in W1.

1. Dave authenticates and calls `GET /api/v1/cards/:cardId/activity`.
2. Assert HTTP 403.
3. Assert no activity data is returned in the response body.

---

### 11.7 Activity feed visible event types allowlist is enforced

**Preconditions:** The activities table contains rows with both visible types (e.g. `card_created`) and a type that is absent from `VISIBLE_EVENT_TYPES` (e.g. a legacy internal type).

1. Insert a row directly with `action = "internal_system_event"` (not in `VISIBLE_EVENT_TYPES`) for an existing card.
2. Call `GET /api/v1/cards/:cardId/activity`.
3. Assert the `internal_system_event` row is **not** present in the response.
4. Assert all expected visible events are still returned.

---

### 11.8 Realtime activity delivery respects card scope — no cross-card pollution

**Setup:** Alice has Card X modal open. Bob simultaneously creates a card (Card Y) in the same list.

1. Bob creates Card Y (`POST /api/v1/lists/:listId/cards`).
2. A `card_created` activity event is emitted for Card Y.
3. Assert Alice's open modal for Card X does **not** show a new activity row.
4. Assert Card X's activity feed count is unchanged.

---

### 11.9 Idempotent card_member_unassigned — repeated unassign produces no extra event

**Preconditions:** Bob has never been assigned to Card X, or was already unassigned.

1. Alice sends `DELETE /api/v1/cards/:cardId/members/:bobId` (Bob not assigned).
2. Assert HTTP 204 (idempotent).
3. Query `GET /api/v1/cards/:cardId/activity`.
4. Assert no `card_member_unassigned` event appears for this operation.

---

### 11.10 Full acceptance smoke test — all four event types in one flow

This is the definitive end-to-end acceptance scenario that must pass before Sprint 88 is closed.

**Actors:** Alice (ADMIN), Bob (MEMBER). Both authenticated. A board with **Backlog** and **Done** lists exists.

1. Alice creates **Card Z** in **Backlog** → expect 201, `card_created` activity written.
2. Alice moves **Card Z** from **Backlog** to **Done** → expect 200, `card_moved` activity written.
3. Alice assigns Bob to **Card Z** → expect 201, `card_member_assigned` activity written.
4. Alice unassigns Bob from **Card Z** → expect 204, `card_member_unassigned` activity written.
5. Call `GET /api/v1/cards/:cardZId/activity`.
6. Assert the feed contains exactly 4 events in descending order:
   - `card_member_unassigned` (most recent)
   - `card_member_assigned`
   - `card_moved`
   - `card_created` (oldest)
7. Assert each event has a unique `id`, a valid `actor_id`, and a non-null `payload`.
8. Open the card modal for **Card Z**.
9. Assert the Activity section renders all four event rows in the same order with correct copy:
   - "removed Bob from this card"
   - "assigned Bob to this card"
   - "moved this card from Backlog to Done"
   - "created this card"
10. Assert Bob received `card_created`, `card_moved`, and `card_member_assigned` notifications (but not `card_member_unassigned` if he was removed before the notification was read — assert at least the assigned notification is visible).
11. Assert Alice received **no** self-notifications.
12. Assert no duplicate rows appear anywhere in the feed or notification panel.
