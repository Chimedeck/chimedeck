# Card Activity Events: Create, Move, Assign / Unassign

Playwright MCP scenario specifications for Sprint 88 card activity events.
These scenarios validate that the correct immutable activity records are emitted
and that payloads match the documented schema.

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
