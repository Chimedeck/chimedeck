# Sprint 17 — Workspace Dashboard & Navigation Shell

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 16 (Auth UI), Sprint 04 (Workspace API)  
> **References:** [requirements §5.2](../architecture/requirements.md)

---

## Goal

Deliver the main application shell: a persistent sidebar, a workspace switcher, the workspaces list page, workspace creation modal, and the boards index page per workspace. All surfaces use a dark Tailwind design that matches the auth pages.

---

## Scope

### 1. Application Shell Layout

```
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR (w-64 bg-slate-900 border-r border-slate-800)    │
│                                                          │
│  [Logo]  Kanban                                         │
│  ─────────────────                                       │
│  ▾ Acme Corp          ← workspace switcher dropdown     │
│    + New workspace                                       │
│  ─────────────────                                       │
│  📋  Boards                                              │
│  👥  Members                                             │
│  ⚙️  Settings                                            │
│  ─────────────────                                       │
│  [Avatar] John Doe ▾  ← user menu (logout, profile)    │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  MAIN CONTENT AREA (flex-1 bg-slate-950 overflow-auto)  │
│                                                          │
│  [Page content rendered here]                           │
└──────────────────────────────────────────────────────────┘
```

Mobile: sidebar collapses to an icon rail (`w-16`). Hamburger opens full sidebar as an overlay drawer.

### 2. File Structure

```
src/extensions/Workspace/
  components/
    Sidebar.tsx               # persistent left nav
    WorkspaceSwitcher.tsx     # dropdown: list workspaces + create new
    UserMenu.tsx              # avatar dropdown: profile, logout
    CreateWorkspaceModal.tsx  # Radix Dialog — workspace name + slug input
    WorkspaceInviteModal.tsx  # invite by email, set role (Admin/Member/Viewer)
    MemberList.tsx            # table of members with role badges
  pages/
    WorkspacesPage.tsx        # list of all workspaces the user belongs to
    BoardsPage.tsx            # grid of boards for current workspace
  slices/
    workspaceSlice.ts         # { workspaces[], activeWorkspace, status }
  api/
    workspace.ts              # getWorkspaces(), createWorkspace(), inviteMember()
src/common/
  layout/
    AppShell.tsx              # sidebar + content area wrapper used by all private pages
    Header.tsx                # top bar (breadcrumb + search icon + user menu)
```

### 3. WorkspacesPage

Cards grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`):

```
┌────────────────────────┐
│  🏢                    │
│  Acme Corp             │
│  12 boards · 5 members │
│                        │
│  [Open]                │
└────────────────────────┘
```

Each card: `bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-colors cursor-pointer`

Empty state: centered illustration + "Create your first workspace" CTA button.

### 4. BoardsPage

Header row: workspace name + `[+ New Board]` button (indigo, top-right).

Board cards grid — each card shows:
- Cover colour strip (top, 4 accent colours selectable on creation)
- Board title (`text-slate-100 font-semibold`)
- Member avatars (stacked, max 4 shown + overflow count)
- "Archived" badge (`bg-slate-700 text-slate-400 text-xs`) when applicable

Click → navigate to `/boards/:boardId`.

### 5. CreateWorkspaceModal

Radix `<Dialog>`:
- `bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full`
- Fields: Workspace name (required), optional description
- Footer: `[Cancel]` (ghost) + `[Create workspace]` (indigo)
- Optimistic: instantly appends to workspace list, rolls back on API error

### 6. Redux Slices

`workspaceSlice`:
```ts
interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  status: 'idle' | 'loading' | 'error';
}
```

Thunks: `fetchWorkspacesThunk`, `createWorkspaceThunk`, `inviteMemberThunk`

### 7. Acceptance Criteria

- [ ] After login, user lands on `/workspaces` and sees all their workspaces
- [ ] Clicking a workspace navigates to its boards list
- [ ] Creating a new workspace via modal persists and appears immediately
- [ ] Sidebar workspace switcher changes active workspace and updates breadcrumb
- [ ] Sidebar collapses on mobile with a hamburger menu
- [ ] "New Board" button is visible on `BoardsPage` for Admins/Owners only (Viewer sees it disabled)
- [ ] User menu shows avatar, name, and working logout that redirects to `/login`

### 8. Tests

```
specs/tests/
  workspace-dashboard.md    # Playwright: log in, see workspaces, open a workspace
  create-workspace.md       # Playwright: click New Workspace, fill form, verify card appears
```

---
