# Workspace Extension

Manages workspaces and provides the main application shell (sidebar + navigation) for all private pages.

## Structure

```
src/extensions/Workspace/
  api.ts                            # Workspace CRUD + invite/member API calls
  routes.ts                         # Route config for WorkspaceListPage and WorkspacePage
  duck/
    workspaceDuck.ts                # Shared slice: workspaces[], activeWorkspaceId, status
  components/
    Sidebar.tsx                     # Persistent sidebar with workspace switcher & nav
    WorkspaceSwitcher.tsx           # Standalone dropdown for workspace switching
    CreateWorkspaceModal.tsx        # Radix Dialog for creating a workspace
    InviteMemberModal.tsx           # Invite by email with role selector
    MemberList.tsx                  # Table of workspace members with role badges
    RoleBadge.tsx                   # Coloured badge for OWNER/ADMIN/MEMBER/VIEWER
    UserMenu.tsx                    # Avatar dropdown with logout and profile links
  containers/
    WorkspaceListPage/              # Grid of all workspaces (post-login landing)
    WorkspacePage/                  # Workspace settings + member management
    AcceptInvitePage/               # Accept an invite via token URL
  translations/
    en.json                         # English i18n strings for all Workspace UI
```

## AppShell integration

`src/layout/AppShell.tsx` wraps all private routes. It renders `Sidebar` on the left and the active page via `<Outlet />` on the right. The AppShell dispatches `fetchWorkspacesThunk` on mount so the sidebar is populated immediately after login.

## Redux state

Key in store: `workspaceShell`

```ts
interface WorkspaceShellState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  status: 'idle' | 'loading' | 'error';
  createInProgress: boolean;
  createError: SerializedError | null;
}
```

### Thunks
- `fetchWorkspacesThunk` — GET /api/v1/workspaces
- `createWorkspaceThunk({ name })` — POST /api/v1/workspaces

### Actions
- `setActiveWorkspace(workspaceId)` — sets active workspace without API call

## Routes

| Path | Component | Auth |
|------|-----------|------|
| `/workspaces` | WorkspaceListPage | ✅ |
| `/workspace` | WorkspacePage | ✅ |
| `/workspace/:workspaceId` | WorkspacePage | ✅ |
| `/invites/:token/accept` | AcceptInvitePage | ❌ |
