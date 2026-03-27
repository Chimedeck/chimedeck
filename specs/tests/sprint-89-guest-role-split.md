> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 89 — Guest Role Split: VIEWER vs MEMBER
## Test Scenarios (Playwright MCP)

---

### Scenario 1: Migration — existing guests default to VIEWER

```
GIVEN the database has existing rows in board_guest_access
WHEN migration 0085_guest_role_type is applied
THEN every existing row has guest_type = 'VIEWER'
AND no rows are deleted or modified in any other column
AND the column is NOT NULL with default 'VIEWER'
```

---

### Scenario 2: New guest invite defaults to VIEWER when guestType is omitted

```
GIVEN a workspace ADMIN is logged in
AND a board exists with id = board-1
WHEN POST /api/v1/boards/board-1/guests is called with { userId: "user-2" } (no guestType)
THEN the response status is 201
AND the newly created board_guest_access row has guest_type = 'VIEWER'
```

---

### Scenario 3: New guest invite with explicit MEMBER type

```
GIVEN a workspace ADMIN is logged in
AND a board exists with id = board-1
WHEN POST /api/v1/boards/board-1/guests is called with { userId: "user-3", guestType: "MEMBER" }
THEN the response status is 201
AND the newly created board_guest_access row has guest_type = 'MEMBER'
```

---

### Scenario 4: VIEWER guest cannot create a card

```
GIVEN user-viewer is a GUEST with guest_type = 'VIEWER' on board-1
WHEN user-viewer calls POST /api/v1/boards/board-1/lists/list-1/cards with a valid card payload
THEN the response status is 403
AND the response body is { name: "guest-viewer-insufficient-permissions" }
```

---

### Scenario 5: VIEWER guest cannot post a comment

```
GIVEN user-viewer is a GUEST with guest_type = 'VIEWER' on board-1
WHEN user-viewer calls POST /api/v1/cards/card-1/comments with { body: "hello" }
THEN the response status is 403
AND the response body is { name: "guest-viewer-insufficient-permissions" }
```

---

### Scenario 6: VIEWER guest cannot upload an attachment

```
GIVEN user-viewer is a GUEST with guest_type = 'VIEWER' on board-1
WHEN user-viewer calls POST /api/v1/cards/card-1/attachments with a file payload
THEN the response status is 403
AND the response body is { name: "guest-viewer-insufficient-permissions" }
```

---

### Scenario 7: MEMBER guest can create a card

```
GIVEN user-member is a GUEST with guest_type = 'MEMBER' on board-1
WHEN user-member calls POST /api/v1/boards/board-1/lists/list-1/cards with a valid card payload
THEN the response status is 201
AND a new card is created in the database
```

---

### Scenario 8: MEMBER guest can post a comment

```
GIVEN user-member is a GUEST with guest_type = 'MEMBER' on board-1
WHEN user-member calls POST /api/v1/cards/card-1/comments with { body: "looks good" }
THEN the response status is 201
AND the comment is persisted
```

---

### Scenario 9: MEMBER guest cannot invite other users

```
GIVEN user-member is a GUEST with guest_type = 'MEMBER' on board-1
WHEN user-member calls POST /api/v1/boards/board-1/guests with { userId: "user-x" }
THEN the response status is 403
AND the response body is { name: "guest-role-no-org-access" }
```

---

### Scenario 10: MEMBER guest cannot access another board

```
GIVEN user-member is a GUEST with guest_type = 'MEMBER' on board-1 only
WHEN user-member calls GET /api/v1/boards/board-2
THEN the response status is 403
```

---

### Scenario 11: ADMIN can update guest type from VIEWER to MEMBER

```
GIVEN user-viewer is a GUEST with guest_type = 'VIEWER' on board-1
AND a workspace ADMIN is logged in
WHEN ADMIN calls PATCH /api/v1/boards/board-1/guests/user-viewer with { guestType: "MEMBER" }
THEN the response status is 200
AND board_guest_access row for user-viewer now has guest_type = 'MEMBER'
```

---

### Scenario 12: Non-ADMIN cannot update guest type

```
GIVEN user-regular is a workspace MEMBER (not ADMIN)
AND user-viewer is a GUEST with guest_type = 'VIEWER' on board-1
WHEN user-regular calls PATCH /api/v1/boards/board-1/guests/user-viewer with { guestType: "MEMBER" }
THEN the response status is 403
```

---

### Scenario 13: List guests includes guestType

```
GIVEN board-1 has two guests: user-a (VIEWER) and user-b (MEMBER)
WHEN GET /api/v1/boards/board-1/guests is called by an ADMIN
THEN the response status is 200
AND each entry in data[] has a guestType field
AND user-a has guestType = "VIEWER"
AND user-b has guestType = "MEMBER"
```

---

### Scenario 14: UI — Guest invite modal shows Viewer / Member toggle

```
GIVEN an ADMIN opens the guest invite modal for board-1
THEN a radio group or toggle with options "Viewer" and "Member" is visible
AND "Viewer" is selected by default
```

---

### Scenario 15: UI — Guest list shows type badge and allows ADMIN to change it

```
GIVEN an ADMIN opens board settings > guest list for board-1
THEN each guest row displays a badge showing "VIEWER" or "MEMBER"
AND each badge is an interactive control (dropdown or button)
WHEN ADMIN changes user-a's badge from VIEWER to MEMBER
THEN PATCH /api/v1/boards/board-1/guests/user-a is called with { guestType: "MEMBER" }
AND the badge updates to "MEMBER" in the UI
```

---

### Scenario 16: UI — VIEWER guest does not see write-action controls

```
GIVEN user-viewer is logged in as a GUEST with guest_type = 'VIEWER' on board-1
WHEN user-viewer navigates to board-1
THEN the "Add card" button is not visible or is disabled
AND the comment input is not visible or is disabled
AND the attachment upload button is not visible or is disabled
AND the card edit pencil / inline edit is not available
AND the assign member button on cards is not visible or is disabled
```

---

### Scenario 17: UI — MEMBER guest sees write-action controls

```
GIVEN user-member is logged in as a GUEST with guest_type = 'MEMBER' on board-1
WHEN user-member navigates to board-1
THEN the "Add card" button is visible and enabled
AND the comment input is visible and enabled
AND the attachment upload button is visible and enabled
```

---

## Iteration 2 Scenarios — Middleware + Guest API

---

### Scenario 18: Middleware attaches guestType = VIEWER for VIEWER guest

```
GIVEN user-viewer is a GUEST with guest_type = 'VIEWER' in board_guest_access for board-1
WHEN user-viewer calls any authenticated board-scoped route (e.g. GET /api/v1/boards/board-1)
THEN req.guestType is 'VIEWER' inside the route handler
AND the request is allowed (200 / 201 range)
```

---

### Scenario 19: Middleware attaches guestType = MEMBER for MEMBER guest

```
GIVEN user-member is a GUEST with guest_type = 'MEMBER' in board_guest_access for board-1
WHEN user-member calls any authenticated board-scoped route (e.g. GET /api/v1/boards/board-1)
THEN req.guestType is 'MEMBER' inside the route handler
AND the request is allowed
```

---

### Scenario 20: Middleware defaults guestType to VIEWER when column is null (backward compat)

```
GIVEN a legacy board_guest_access row has guest_type = NULL (pre-migration state)
WHEN the guest accesses board-1
THEN req.guestType is 'VIEWER' (falls back to VIEWER, never null)
```

---

### Scenario 21: Invite endpoint persists explicit guestType = MEMBER

```
GIVEN a workspace ADMIN is logged in
AND a board exists with id = board-1
WHEN POST /api/v1/boards/board-1/guests is called with { email: "member@example.com", guestType: "MEMBER" }
THEN the response status is 201
AND the response data.guestType = "MEMBER"
AND board_guest_access row has guest_type = 'MEMBER'
```

---

### Scenario 22: Invite endpoint rejects invalid guestType value

```
GIVEN a workspace ADMIN is logged in
WHEN POST /api/v1/boards/board-1/guests is called with { email: "x@y.com", guestType: "SUPERUSER" }
THEN the response status is 400
AND the response body is { name: "invalid-guest-type" }
```

---

### Scenario 23: PATCH updates guestType and emits event

```
GIVEN user-viewer is a GUEST with guest_type = 'VIEWER' on board-1
AND a workspace ADMIN is logged in
WHEN ADMIN calls PATCH /api/v1/boards/board-1/guests/user-viewer with { guestType: "MEMBER" }
THEN the response status is 200
AND the response data.guestType = "MEMBER"
AND board_guest_access row has guest_type = 'MEMBER'
AND a member_updated event is emitted with { userId: "user-viewer", guestType: "MEMBER" }
```

---

### Scenario 24: PATCH returns 404 for non-existent guest

```
GIVEN no board_guest_access row exists for user-unknown on board-1
AND a workspace ADMIN is logged in
WHEN ADMIN calls PATCH /api/v1/boards/board-1/guests/user-unknown with { guestType: "MEMBER" }
THEN the response status is 404
AND the response body is { name: "guest-access-not-found" }
```

---

### Scenario 25: PATCH rejects invalid guestType value

```
GIVEN user-viewer is a GUEST on board-1
AND a workspace ADMIN is logged in
WHEN ADMIN calls PATCH /api/v1/boards/board-1/guests/user-viewer with { guestType: "OWNER" }
THEN the response status is 400
AND the response body is { name: "invalid-guest-type" }
```

---

### Scenario 26: PATCH requires ADMIN role

```
GIVEN user-member-ws is a workspace MEMBER (not ADMIN)
AND user-viewer is a GUEST on board-1
WHEN user-member-ws calls PATCH /api/v1/boards/board-1/guests/user-viewer with { guestType: "MEMBER" }
THEN the response status is 403
```

---

### Scenario 27: List guests returns guestType field in camelCase

```
GIVEN board-1 has two guests: user-a (VIEWER) and user-b (MEMBER)
WHEN GET /api/v1/boards/board-1/guests is called by an ADMIN
THEN the response status is 200
AND each entry contains { id, email, name, guestType, grantedAt, grantedBy }
AND user-a has guestType = "VIEWER"
AND user-b has guestType = "MEMBER"
```

---

## Iteration 3 Scenarios — Client Permission Guard + Invite Modal Toggle

---

### Scenario 28: UI — Guest invite modal defaults role toggle to Viewer

```
GIVEN an ADMIN opens the guest invite panel for board-1 (GuestsTab)
THEN the "Viewer" toggle button has aria-pressed="true"
AND the "Member" toggle button has aria-pressed="false"
```

---

### Scenario 29: UI — Admin selects Member role before inviting

```
GIVEN an ADMIN opens the guest invite panel for board-1
WHEN ADMIN clicks the "Member" toggle button
THEN the "Member" toggle button has aria-pressed="true"
AND the "Viewer" toggle button has aria-pressed="false"
WHEN ADMIN enters "newmember@example.com" and submits
THEN POST /api/v1/boards/board-1/guests is called with { email: "newmember@example.com", guestType: "MEMBER" }
AND the success message reads "newmember@example.com invited as a Member."
AND the role toggle resets to "Viewer" after successful invite
```

---

### Scenario 30: UI — Successful invite with Viewer role shows correct message

```
GIVEN an ADMIN opens the guest invite panel for board-1
AND the "Viewer" toggle is selected (default)
WHEN ADMIN enters "viewer@example.com" and submits
THEN POST /api/v1/boards/board-1/guests is called with { email: "viewer@example.com", guestType: "VIEWER" }
AND the success message reads "viewer@example.com invited as a Viewer."
```

---

### Scenario 31: canBoardGuestWrite returns false for VIEWER

```
GIVEN guestType is "VIEWER"
WHEN canBoardGuestWrite("VIEWER") is called
THEN it returns false
```

---

### Scenario 32: canBoardGuestWrite returns true for MEMBER

```
GIVEN guestType is "MEMBER"
WHEN canBoardGuestWrite("MEMBER") is called
THEN it returns true
```

---

### Scenario 33: canBoardGuestWrite returns true for null (non-guest user)

```
GIVEN guestType is null (caller is a regular workspace member, not a guest)
WHEN canBoardGuestWrite(null) is called
THEN it returns true
AND write-action controls remain visible
```

---

## Iteration 4 Scenarios — Client Guest Management Panel + UI Permission Guards

---

### Scenario 34: UI — Guest list shows Viewer badge for VIEWER guests

```
GIVEN board-1 has a guest user-a with guestType = 'VIEWER'
AND any authenticated board member views the Board Members panel > Guests tab
THEN user-a's row shows a "Viewer" badge
AND the badge style indicates it is the active selection
```

---

### Scenario 35: UI — Guest list shows Member badge for MEMBER guests

```
GIVEN board-1 has a guest user-b with guestType = 'MEMBER'
AND any authenticated board member views the Board Members panel > Guests tab
THEN user-b's row shows a "Member" badge
AND the badge style indicates it is the active selection
```

---

### Scenario 36: UI — ADMIN can change guest type from Viewer to Member inline

```
GIVEN an ADMIN views the Board Members panel > Guests tab for board-1
AND user-a has guestType = 'VIEWER'
WHEN ADMIN clicks the "Member" button in user-a's row
THEN PATCH /api/v1/boards/board-1/guests/user-a is called with { guestType: "MEMBER" }
AND on success the "Member" badge becomes active for user-a
AND the "Viewer" badge becomes inactive
```

---

### Scenario 37: UI — ADMIN can change guest type from Member to Viewer inline

```
GIVEN an ADMIN views the Board Members panel > Guests tab for board-1
AND user-b has guestType = 'MEMBER'
WHEN ADMIN clicks the "Viewer" button in user-b's row
THEN PATCH /api/v1/boards/board-1/guests/user-b is called with { guestType: "VIEWER" }
AND on success the "Viewer" badge becomes active for user-b
```

---

### Scenario 38: UI — Failed inline guest type change shows per-row error

```
GIVEN an ADMIN views the Board Members panel > Guests tab for board-1
AND user-a has guestType = 'VIEWER'
WHEN ADMIN clicks the "Member" button for user-a
AND the PATCH request fails (e.g. 403 or network error)
THEN an error message appears below user-a's row
AND the badge does not change from "Viewer"
```

---

### Scenario 39: UI — Non-ADMIN sees read-only type badge (not interactive)

```
GIVEN a workspace MEMBER (not ADMIN) views the Board Members panel > Guests tab
AND user-a has guestType = 'VIEWER'
THEN user-a's row shows a "Viewer" badge
AND the badge is NOT an interactive button (no aria-pressed)
```

---

### Scenario 40: UI — VIEWER guest does not see "Add a card" button

```
GIVEN user-viewer is logged in as GUEST with guestType = 'VIEWER' on board-1
WHEN user-viewer navigates to board-1 in Kanban view
THEN no "+ Add a card" button is visible in any list column
AND the "Add list" form is not shown
```

---

### Scenario 41: UI — MEMBER guest sees "Add a card" button

```
GIVEN user-member is logged in as GUEST with guestType = 'MEMBER' on board-1
WHEN user-member navigates to board-1 in Kanban view
THEN the "+ Add a card" button is visible in each list column
```

---

### Scenario 42: UI — VIEWER guest does not see comment input in card modal

```
GIVEN user-viewer is logged in as GUEST with guestType = 'VIEWER' on board-1
WHEN user-viewer opens a card modal
THEN the CommentEditor (comment input area) is not rendered in the Activity feed
AND existing comments are still visible
```

---

### Scenario 43: UI — VIEWER guest does not see attachment upload controls in card modal

```
GIVEN user-viewer is logged in as GUEST with guestType = 'VIEWER' on board-1
WHEN user-viewer opens a card modal
THEN the "Attach file" button is not visible
AND the "Attach a link" button is not visible
AND the file drop zone does not accept files
AND existing attachments are still listed
```

---

### Scenario 44: UI — MEMBER guest sees comment input and attachment upload controls

```
GIVEN user-member is logged in as GUEST with guestType = 'MEMBER' on board-1
WHEN user-member opens a card modal
THEN the CommentEditor is visible and enabled
AND the "Attach file" button is visible and enabled
AND the "Attach a link" button is visible and enabled
```

---

### Scenario 45: UI — callerGuestType is included in board GET response for VIEWER guest

```
GIVEN user-viewer is a GUEST with guestType = 'VIEWER' on board-1
WHEN GET /api/v1/boards/board-1 is called by user-viewer
THEN the response data.callerGuestType = "VIEWER"
```

---

### Scenario 46: UI — callerGuestType is null in board GET response for workspace member

```
GIVEN user-admin is a workspace ADMIN (not a GUEST)
WHEN GET /api/v1/boards/board-1 is called by user-admin
THEN the response data.callerGuestType is null or absent
```