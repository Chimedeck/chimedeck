# Sprint 80 — Guest Experience UI

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 78 (Board Members + Visibility API), Sprint 79 (Board Member Management UI), Sprint 49 (Guest Role + `board_guest_access`), Sprint 17 (Workspace Dashboard)
> **References:** [requirements §3 — Roles & Authorization](../architecture/requirements.md)

---

## Goal

Deliver the guest-facing experience. A guest user (workspace role `GUEST`) can be invited to one or more specific boards by a board ADMIN or workspace OWNER/ADMIN. Once logged in, a guest sees a scoped workspace view showing only the boards they have been added to — not other boards, not the member list. They can view and edit cards on their granted boards but cannot change board settings or invite others.

---

## Scope

### 1. Guest Invite Flow (Board Admin Side)

**`src/extensions/Board/components/BoardMembersPanel/`**

Extend the Board Members Panel (Sprint 79) with a separate **Guests** tab:

```
Board Members    |    Guests
─────────────────────────────────────────
[Avatar] dan@external.com   Guest   [✕]

+ Invite guest by email…
─────────────────────────────────────────
```

#### 1a. Invite by email or username

- Text input accepting either an **email address** or a **username** (the system resolves either to a user account)
- Validation: if the value contains `@` treat as email, otherwise treat as username
- On submit:
  1. If the resolved user is already a workspace member → error toast: "This user is already a workspace member. Add them as a board member instead."
  2. If the value is an email and **no matching user exists** → create a stub account via `POST /api/v1/admin/users` (Sprint 44) with `autoVerifyEmail: true`, then grant board access. (Username-only lookups require the user to already exist — show error toast if not found.)
  3. If the user exists but is not a workspace member → grant `GUEST` workspace membership and add to `board_guest_access`
  4. `POST /api/v1/boards/:id/guests` (Sprint 49 API) — request body accepts `{ email }` or `{ username }` (server resolves to `userId`)
- Success: invite email sent via SES (if email notifications enabled) containing board URL and credentials (if new account)

#### 1b. Revoke access

- Trash icon on each guest row
- `DELETE /api/v1/boards/:id/guests/:userId`
- If the guest has no remaining `board_guest_access` rows, their workspace membership is automatically downgraded/removed server-side

---

### 2. Guest Workspace View

When the logged-in user has workspace role `GUEST`, the workspace dashboard renders a **scoped view**:

#### 2a. Boards grid

- Shows only boards where the user has a `board_guest_access` row
- The workspace boards API already filters this server-side (Sprint 78)
- No "Create board" button shown to guests

#### 2b. Workspace name and branding

- Workspace name and logo are visible so the guest knows which org they are working in
- No workspace settings link or admin controls rendered

#### 2c. Member list hidden

- Sidebar or any "Members" link that would call `GET /api/v1/workspaces/:id/members` is hidden
- If the route is navigated to directly, show a `403` notice: "You don't have permission to view workspace members."

#### 2d. Navigation sidebar

```
┌────────────────────────────────┐
│  Acme Corp                     │
├────────────────────────────────┤
│  📋  Q3 Roadmap         (guest)│
│  📋  Design Review      (guest)│
└────────────────────────────────┘
```

- Only granted boards appear in the sidebar
- Each board is labelled with a subtle `(guest)` indicator
- No "All boards", "Templates", "Members" or "Settings" links shown to GUEST users

---

### 3. Guest Permissions Enforcement (Client)

For a GUEST user on a board they have access to:

| UI Element | Guest visibility |
|---|---|
| Card create / edit | ✅ Visible and functional |
| Card delete | ✅ Visible and functional |
| Board settings (visibility, description) | ❌ Hidden |
| Board member management panel | ❌ Hidden |
| Guest invite tab | ❌ Hidden |
| "Invite to board" button | ❌ Hidden |

All hidden elements must also be rejected server-side (Sprint 78) — the client enforcement is UX only.

---

### 4. Redux / RTK Query

**`src/extensions/Board/slices/boardGuestsSlice.ts`**

RTK Query endpoints:
- `getBoardGuests` — `GET /api/v1/boards/:id/guests`
- `inviteBoardGuest` — `POST /api/v1/boards/:id/guests`
- `removeBoardGuest` — `DELETE /api/v1/boards/:id/guests/:userId`

**`src/extensions/Workspace/slices/workspaceSlice.ts`**

Extend existing workspace slice to expose `currentUserWorkspaceRole` so components can gate on `GUEST`.

---

### 5. Auth-Aware Route Guards

**`src/routing/`**

Update `PrivateRoute` or equivalent guard:
- If `currentUserWorkspaceRole === 'GUEST'` and route is `/workspaces/:id/members` → redirect to workspace boards view with a toast.
- If `currentUserWorkspaceRole === 'GUEST'` and route is `/workspaces/:id/boards/:boardId` where the board is not in their granted list → show 403 page.

---

## Acceptance Criteria

- [ ] Board Admin can invite a guest by email from the Guests tab in the Board Members Panel
- [ ] Inviting an existing workspace member shows an error and blocks the action
- [ ] Guest stub account is created automatically if the email is unknown
- [ ] Guest sees only their granted boards in the workspace dashboard
- [ ] Guest cannot see the workspace member list (UI hidden + API returns 403)
- [ ] Guest cannot access board settings or member management UI
- [ ] Guest can create, edit, and delete cards on their granted boards
- [ ] Revoking access removes the guest from the board
- [ ] If a guest has no remaining board grants after revocation, workspace membership is cleaned up
- [ ] `(guest)` label shown on sidebar board entries for the guest user
