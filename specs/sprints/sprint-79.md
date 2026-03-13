# Sprint 79 — Board Member Management UI

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 78 (Board Members Table + Visibility API), Sprint 18 (Board View UI), Sprint 17 (Workspace Dashboard)
> **References:** [requirements §3 — Roles & Authorization](../architecture/requirements.md)

---

## Goal

Expose the board membership and visibility controls introduced in Sprint 78 through the client UI. Users can:

- Set board visibility (`PRIVATE` / `WORKSPACE` / `PUBLIC`) from board settings
- View the explicit member list of a board
- Add workspace members to a `PRIVATE` board by name or email
- Change a board member's role
- Remove a board member
- Understand at a glance which boards they have private access to in the workspace board grid

---

## Scope

### 1. Board Settings Panel — Visibility Selector

**`src/extensions/Board/components/BoardSettings/`**

Add a **Visibility** section to the existing board settings panel (or create one if absent):

```
Board Visibility
────────────────────────────────────────
● Private (default)
  Only you, workspace admins, and
  explicitly added members can see this board.

○ Workspace
  All workspace members can view and edit.

○ Public
  Anyone on the internet can view.
  Only board members can edit.
────────────────────────────────────────
```

- Selecting a visibility fires `PATCH /api/v1/boards/:id` with `{ visibility }`.
- Optimistic update — revert on error.
- Only visible to workspace OWNER/ADMIN or board ADMIN.

---

### 2. Board Members Panel

**`src/extensions/Board/components/BoardMembersPanel/`**

Accessible from the board header (e.g. "Members" button or avatar stack). Shows the explicit `board_members` list.

```
Board Members
──────────────────────────────────────────────
[Avatar] Alice Nguyen      Admin     [▾] [✕]
[Avatar] Bob Smith         Member    [▾] [✕]
[Avatar] Carol Tran        Viewer    [▾] [✕]

+ Add member…
──────────────────────────────────────────────
```

#### 2a. Add member

- Text input with typeahead searching workspace members (GET `/api/v1/workspaces/:id/members?q=<query>`) — excludes already-added members and guests
- Role selector dropdown (Admin / Member / Viewer), defaults to Member
- On confirm: `POST /api/v1/boards/:id/members`

#### 2b. Change role

- Inline dropdown on each row
- On change: `PATCH /api/v1/boards/:id/members/:userId`
- If the current user tries to demote themselves off the last ADMIN slot, show an error toast: "You are the only admin on this board."

#### 2c. Remove member

- Trash icon on each row — confirm dialog: "Remove [name] from this board?"
- `DELETE /api/v1/boards/:id/members/:userId`
- If removing the last ADMIN, show error toast without sending the request (client-side guard).

---

### 3. Workspace Boards Grid — Visibility Badge

**`src/extensions/Workspace/components/BoardCard/`**

Show a small badge on each board card in the workspace grid to communicate visibility:

| Visibility | Badge |
|---|---|
| `PRIVATE` | 🔒 Private |
| `WORKSPACE` | 🏢 Workspace |
| `PUBLIC` | 🌐 Public |

Only show the badge when it differs from the workspace default (`PRIVATE` always shown; `WORKSPACE` shown as a neutral tag; `PUBLIC` shown in a distinct colour).

---

### 4. Board Header — Members Avatar Stack

**`src/extensions/Board/components/BoardHeader/`**

- Show up to 5 member avatars stacked horizontally; overflow shown as `+N`
- Clicking the stack opens the **Board Members Panel** (§2)
- Source: `GET /api/v1/boards/:id/members`

---

### 5. Redux / RTK Query

**`src/extensions/Board/slices/boardMembersSlice.ts`**

RTK Query endpoints:
- `getBoardMembers` — `GET /api/v1/boards/:id/members`
- `addBoardMember` — `POST /api/v1/boards/:id/members`
- `updateBoardMemberRole` — `PATCH /api/v1/boards/:id/members/:userId`
- `removeBoardMember` — `DELETE /api/v1/boards/:id/members/:userId`

Cache invalidation: all endpoints invalidate `getBoardMembers` for that board.

---

## Acceptance Criteria

- [ ] Visibility selector in board settings persists correctly and reflects the current value on load
- [ ] Only OWNER/ADMIN/board-ADMIN can see the visibility selector and member management panel
- [ ] Board Members Panel lists current explicit members with their roles
- [ ] Add member typeahead returns only workspace members not already on the board
- [ ] Role change and remove actions work with optimistic updates and revert on error
- [ ] Client-side guard prevents removing the last board ADMIN
- [ ] Workspace board grid shows correct visibility badge
- [ ] Board header avatar stack renders and opens the members panel on click
