# Sprint 87 - Board Deletion Auto-Refresh

> **Status:** Future sprint - not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 5 (Board Lifecycle), Sprint 17 (Workspace Dashboard), Sprint 20 (Real-Time UI)
> **References:** [requirements.md](../architecture/requirements.md)

---

## Goal

When a board is deleted, UI must refresh automatically without requiring manual page reload.

This sprint delivers:
- Immediate UI updates after board deletion
- Cache/store invalidation for board collections
- Safe redirect behavior when current open board is deleted

---

## Scope

### 1. Client Mutation Update Flow

On successful board delete:
- Remove board from workspace board list immediately
- Remove board from recent boards and starred boards views
- Invalidate board-related cached queries

### 2. Current-Board Deletion Handling

If deleted board is currently open:
- Close any open card modal
- Redirect user to workspace boards page
- Show success toast: `Board deleted`

### 3. Real-Time Propagation

Publish board-deleted event to connected clients in workspace so other users also see board removed without reload.

### 4. Error and Rollback

- If delete fails, rollback optimistic removal
- Show actionable error toast
- Prevent ghost board state in sidebar/grid

---

## File Checklist

| File | Change |
|------|--------|
| `server/extensions/board/api/delete.ts` | Ensure delete success payload and workspace event publish |
| `server/extensions/events/mods/publishBoardDeleted.ts` | New event publisher for board deletion |
| `src/extensions/Board/api.ts` | Standardized delete board mutation client |
| `src/extensions/Board/slices/boardsSlice.ts` | Immediate store removal + rollback path |
| `src/pages/BoardPage.tsx` | Redirect when current board is deleted |
| `src/pages/WorkspaceBoardsPage.tsx` | Refresh/invalidate lists automatically |
| `specs/tests/board-delete-auto-refresh.md` | End-to-end delete and refresh tests |

---

## Acceptance Criteria

- [ ] Deleting a board updates board lists immediately without browser reload
- [ ] If user is viewing deleted board, app redirects automatically to workspace boards page
- [ ] Other connected users receive board removal via real-time update
- [ ] Failed delete rolls back optimistic UI correctly

---

## Tests

```text
specs/tests/board-delete-auto-refresh.md
```
