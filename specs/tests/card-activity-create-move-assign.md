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
