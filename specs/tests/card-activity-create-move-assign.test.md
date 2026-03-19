# card-activity-create-move-assign — Playwright MCP test scenarios

> Covers Sprint 88 activity event emission for card_created, card_moved, and
> member assignment/unassignment.  Scenarios use the Playwright MCP test
> runner.  Each scenario is self-contained; set-up steps are listed
> explicitly so they can be executed in isolation.

---

## CACA-CREATE-01 — card_created event is written to the activities table

**Actor:** Authenticated MEMBER of a workspace + board  
**Preconditions:** A board with at least one list exists

**Steps:**
1. `POST /api/v1/lists/:listId/cards` with `{ "title": "New card from test" }` using a valid auth token.
2. Assert HTTP 201 and `data.id` is a UUID.
3. `GET /api/v1/cards/:id/activity` for the returned card ID.
4. Assert HTTP 200 and `data` array contains exactly one entry where:
   - `action` = `"card_created"`
   - `entity_id` = returned card ID
   - `actor_id` = ID of the authenticated user
   - `payload.cardTitle` = `"New card from test"`
   - `payload.listId` = the list ID used in step 1
   - `payload.boardId` is a non-empty string
   - `payload.workspaceId` is a non-empty string

**Pass criteria:** All assertions in step 4 hold true.

---

## CACA-CREATE-02 — card_created event appears in the card activity feed UI

**Actor:** Authenticated MEMBER  
**Preconditions:** Same board as CACA-CREATE-01; the card from CACA-CREATE-01 exists

**Steps:**
1. Navigate to the board page.
2. Open the card modal for the newly created card.
3. Scroll to the **Activity** section.
4. Assert that the activity feed contains an entry with text matching
   `"created this card"` attributed to the correct user.

**Pass criteria:** The card_created activity message is rendered in the modal
activity feed.

---

## CACA-CREATE-03 — no card_created event is written for a failed creation

**Actor:** Authenticated MEMBER  
**Preconditions:** A valid list exists

**Steps:**
1. `POST /api/v1/lists/:listId/cards` with `{}` (missing `title`).
2. Assert HTTP 400.
3. `GET /api/v1/cards` or check the activities table — no new `card_created`
   row should exist for the failing request.

**Pass criteria:** Step 2 returns 400; no activity record is created.

---

## CACA-CREATE-04 — card_created payload contains immutable fields

**Actor:** Any MEMBER  
**Preconditions:** Card created via CACA-CREATE-01 setup

**Steps:**
1. Retrieve the `card_created` activity row via
   `GET /api/v1/cards/:id/activity`.
2. Confirm `payload.cardId` equals the card's UUID.
3. Attempt to update the card title via `PATCH /api/v1/cards/:id`.
4. Re-fetch the activity row and confirm the `payload.cardTitle` in the
   original `card_created` event still reflects the title at creation time
   (i.e., the activity row was not mutated).

**Pass criteria:** The `card_created` activity payload is immutable after
creation and reflects the state at creation time.

---

## CACA-CREATE-05 — unauthorized user cannot see card_created activity

**Actor:** Unauthenticated request  
**Preconditions:** Card and its activity record exist

**Steps:**
1. `GET /api/v1/cards/:id/activity` without an auth token.
2. Assert HTTP 401 or 403.

**Pass criteria:** Activity feed is not accessible without authentication.
