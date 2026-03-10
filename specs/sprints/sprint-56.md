# Sprint 56 — Business Logic Invariants

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 04 (Workspace Lifecycle), Sprint 05 (Board Lifecycle), Sprint 06 (List Management), Sprint 07 (Card Core)  
> **References:** [requirements §5 — Business Logic Invariants](../architecture/requirements.md)

---

## Goal

Three server-side business logic invariants specified in the requirements are currently unenforced — enforcement exists only on the client side (if at all), which means a direct API call can bypass them. This sprint moves enforcement to the server:

1. **Archived boards are read-only** — mutation endpoints must reject changes when the parent board is archived
2. **Workspace ≥1 Owner invariant** — it must be impossible to leave a workspace without an Owner
3. **Delete confirmation enforcement** — deleting a board/list/card that contains nested entities must be confirmed server-side (idempotent confirm flag in request)

---

## Scope

### 1. Archived Board Read-Only Guard

#### Middleware — `server/middlewares/archivedBoardGuard.ts` (new)

```ts
// Applied to all mutation routes scoped to a board (lists, cards, comments, etc.)
// Resolves the parent board from the request path and rejects with 403 if archived
const board = await getBoardForRequest(req);
if (board.archived_at !== null) {
  return res.status(403).json({
    error: {
      code: 'board-is-archived',
      message: 'This board is archived and cannot be modified.',
    },
  });
}
```

Apply to all routes that mutate lists or cards:
- `POST/PATCH/DELETE /api/v1/lists/:id`
- `POST/PATCH/DELETE /api/v1/cards/:id`
- `POST /api/v1/lists/:id/cards`
- `POST /api/v1/cards/:id/comments`
- `PUT /api/v1/cards/:id/custom-field-values/:fieldId` (Sprint 55)

---

### 2. Workspace ≥1 Owner Invariant

#### Guard location: `server/extensions/workspace/` — membership update + removal handlers

Before completing a role change or member removal, verify the workspace will still have at least one `OWNER`:

```ts
const ownerCount = await db('memberships')
  .where({ workspace_id: workspaceId, role: 'OWNER' })
  .count('id as count')
  .first();

const removingLastOwner =
  (targetCurrentRole === 'OWNER') &&
  (Number(ownerCount.count) <= 1);

if (removingLastOwner) {
  return res.status(422).json({
    error: {
      code: 'workspace-must-have-one-owner',
      message: 'A workspace must always have at least one Owner. Promote another member first.',
    },
  });
}
```

Apply this check to:
- `DELETE /api/v1/workspaces/:id/members/:userId`
- `PATCH /api/v1/workspaces/:id/members/:userId` (when changing role away from `OWNER`)

---

### 3. Delete Confirmation Flag

Deleting an entity that contains nested content (board with lists/cards, list with cards) must include `"confirm": true` in the request body, otherwise the server returns `409` with a summary of what will be deleted.

#### Affected endpoints

| Endpoint | Nested content checked |
|---|---|
| `DELETE /api/v1/boards/:id` | Number of lists + cards |
| `DELETE /api/v1/lists/:id` | Number of cards |

#### Behaviour without `confirm: true`

```json
HTTP 409
{
  "error": {
    "code": "delete-requires-confirmation",
    "message": "This board contains 3 lists and 24 cards. Send { \"confirm\": true } to proceed."
  },
  "data": { "listCount": 3, "cardCount": 24 }
}
```

#### Behaviour with `confirm: true`

Proceed with deletion as normal.

> For `DELETE /api/v1/cards/:id` (leaf entity — no nested content), no confirmation is required.

---

### 4. Client-Side Updates

Update the delete confirmation dialogs in `src/` to include `confirm: true` in the DELETE request body. The `409` response should surface a friendly confirmation dialog if the client omits the flag.

---

## Acceptance Criteria

- [ ] `PATCH /cards/:id` on a card belonging to an archived board returns `403 board-is-archived`
- [ ] `POST /lists/:id/cards` on an archived board returns `403 board-is-archived`
- [ ] `PATCH /workspaces/:id/members/:userId` changing the last Owner's role returns `422 workspace-must-have-one-owner`
- [ ] `DELETE /workspaces/:id/members/:userId` for the last Owner returns `422 workspace-must-have-one-owner`
- [ ] `DELETE /boards/:id` without `confirm: true` returns `409` with list/card counts
- [ ] `DELETE /boards/:id` with `confirm: true` deletes the board
- [ ] `DELETE /lists/:id` without `confirm: true` returns `409` with card count
- [ ] `DELETE /lists/:id` with `confirm: true` deletes the list and its cards
