# Test: Guest Role — Access Control for Board Guests

**Sprint:** 49  
**Tool:** Playwright

---

## Test 1: Invite a User as Guest

### Setup
- Log in as a workspace ADMIN
- Have a second user who is NOT a workspace member
- Navigate to a board owned by the admin's workspace

### Steps
1. `POST /api/v1/boards/:boardId/guests` with body `{ "userId": "<secondUserId>" }`

### Acceptance Criteria
- [ ] Response status is `201`
- [ ] Response body has `data.board_id`, `data.user_id`, `data.granted_at`, `data.granted_by`
- [ ] Second user now has a `GUEST` membership row in the workspace
- [ ] `board_guest_access` row exists for `(user_id, board_id)` pair

---

## Test 2: List Board Guests

### Setup
- At least one guest invited to the board (from Test 1)

### Steps
1. `GET /api/v1/boards/:boardId/guests` as ADMIN

### Acceptance Criteria
- [ ] Response status is `200`
- [ ] Response body has `data` array with guest user entries
- [ ] Each entry includes `id`, `email`, `name`, `granted_at`, `granted_by`

---

## Test 3: Revoke Guest Access

### Setup
- Guest user has access to a board (from Test 1)

### Steps
1. `DELETE /api/v1/boards/:boardId/guests/:guestUserId` as ADMIN

### Acceptance Criteria
- [ ] Response status is `200`
- [ ] Response body has `data.revoked: true`
- [ ] `board_guest_access` row is deleted
- [ ] If no other board grants remain, `GUEST` membership is also removed

---

## Test 4: Mutation Endpoints Return 403 for GUEST

### Setup
- Log in as a GUEST user with access to a board
- Have the board ID available

### Steps
1. `PATCH /api/v1/boards/:boardId` with `{ "title": "Hacked" }`
2. `DELETE /api/v1/boards/:boardId`
3. `PATCH /api/v1/boards/:boardId/archive`
4. `POST /api/v1/boards/:boardId/duplicate`
5. `POST /api/v1/boards/:boardId/labels` with `{ "name": "x", "color": "#000" }`
6. `POST /api/v1/boards/:boardId/guests` with `{ "userId": "<anyUserId>" }`

### Acceptance Criteria
- [ ] All six requests return status `403`
- [ ] Each response body has `name: "guest-role-insufficient-permissions"`

---

## Test 5: Guest Read Access is Allowed

### Setup
- Log in as a GUEST user with access to a board

### Steps
1. `GET /api/v1/boards/:boardId`
2. `GET /api/v1/boards/:boardId/members`
3. `GET /api/v1/boards/:boardId/labels`
4. `GET /api/v1/boards/:boardId/guests`

### Acceptance Criteria
- [ ] All read requests return status `200`
- [ ] Board data is returned for requests 1–4

---

## Test 6: Duplicate Invite is Idempotent

### Setup
- Guest user already has access to a board

### Steps
1. `POST /api/v1/boards/:boardId/guests` with the same `{ "userId": "<guestUserId>" }` again

### Acceptance Criteria
- [ ] Response status is `201`
- [ ] No duplicate `board_guest_access` rows are created
- [ ] No duplicate `memberships` rows are created

---

## Test 7: Inviting an Existing Workspace Member as Guest is Rejected

### Setup
- Target user is already a workspace MEMBER

### Steps
1. `POST /api/v1/boards/:boardId/guests` with `{ "userId": "<memberUserId>" }`

### Acceptance Criteria
- [ ] Response status is `409`
- [ ] Response body has `name: "user-already-workspace-member"`

---

## Test 8: Non-Admin Cannot Invite Guests

### Setup
- Log in as a workspace MEMBER (not ADMIN or OWNER)

### Steps
1. `POST /api/v1/boards/:boardId/guests` with `{ "userId": "<anyUserId>" }`

### Acceptance Criteria
- [ ] Response status is `403`
- [ ] Response body has `name: "insufficient-role"`

---

## Test 9: Inviting Non-Existent User Returns 404

### Setup
- Log in as ADMIN

### Steps
1. `POST /api/v1/boards/:boardId/guests` with `{ "userId": "does-not-exist" }`

### Acceptance Criteria
- [ ] Response status is `404`
- [ ] Response body has `name: "user-not-found"`
