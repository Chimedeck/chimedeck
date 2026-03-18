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
