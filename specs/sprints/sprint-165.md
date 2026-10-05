# Sprint 165 - Board Chat Access Control + Guest Overrides

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 164 (Board Chat UI Entry + Sidebar History)
> **Status:** ⬜ Future

---

## Goal

Implement board-level chat permissions so workspace members can use chat by default, while guests are blocked unless explicitly allowed via controls in the chat sidebar.

---

## Strict Boundary

1. Access control and permission settings only.
2. Message persistence details are handled in Sprint 166.
3. AI provider integration is out of scope.

---

## Scope

### 1. Permission Model

Define chat permissions at board scope:

- `org_member_can_view = true` (fixed)
- `org_member_can_use = true` (fixed)
- `guest_can_view = false` (configurable)
- `guest_can_use = false` (configurable)

Guest use implies guest view at validation time.

### 2. API and Persistence

Add board chat permission storage and API endpoints:

- `GET /api/v1/boards/:boardId/chat-permissions`
- `PATCH /api/v1/boards/:boardId/chat-permissions`

Only workspace members on the board with ADMIN/OWNER can update guest toggles.

### 3. Sidebar Controls

In the chat sidebar, add two controls with exact labels:

- `ALLOW GUEST TO VIEW`
- `ALLOW GUEST TO USE`

Rules:
- If view is off, use is forced off.
- If use is toggled on, view auto-enables.
- Controls are hidden/disabled for guests.

Visual and interaction requirements:
- Show guest status caption at top of permissions block (for example `GUEST ACCESS (MEMBER ONLY)`).
- Render both controls as prominent action buttons inside the chat sidebar body.
- Show lock icon/state when actor cannot change guest permissions.
- Persist button state immediately after toggle with optimistic UI + rollback on API failure.

### 4. Runtime Enforcement

- Guests cannot fetch history when `guest_can_view=false`.
- Guests cannot send messages when `guest_can_use=false`.
- Server returns `403` with typed error names for denied operations.

UI feedback requirements:
- If guest view is denied, sidebar should not render message history and should show permission-empty state.
- If guest use is denied, composer is disabled with helper copy.

---

## Deliverables

1. DB migration for board chat permission fields/table.
2. Permission API endpoints + middleware guard.
3. Sidebar controls for guest view/use toggles.
4. Server-side enforcement for read/send chat actions.
5. Integration tests for permission matrix.
6. Permission-locked visual states for non-authorised users.

---

## Acceptance Criteria

1. Workspace members can always view and send chat messages.
2. Guests cannot see chat history or send messages by default.
3. ADMIN/OWNER can enable `ALLOW GUEST TO VIEW` and `ALLOW GUEST TO USE` from chat sidebar.
4. Enabling use auto-enables view; disabling view also disables use.
5. Guest receives `403` on history/send when not allowed.
6. Guest can view and send only when both relevant toggles permit it.
7. Non-admin/non-owner users cannot mutate toggles and see locked controls in sidebar UI.
