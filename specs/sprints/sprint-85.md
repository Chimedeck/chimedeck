# Sprint 85 - Collapsible Sidebar Drawer with Tailwind CSS

> **Status:** Future sprint - not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 15 (UI Foundation), Sprint 17 (Workspace Dashboard), Sprint 18 (Board View Kanban)
> **References:** [requirements.md](../architecture/requirements.md)

---

## Goal

Make the side menu collapsible like a drawer using Tailwind CSS so users can reclaim horizontal space while keeping navigation quickly accessible.

This sprint delivers:
- Desktop collapse/expand sidebar behavior
- Mobile slide-in drawer behavior
- Persistent user preference for collapsed state

---

## Scope

### 1. Desktop Sidebar Collapse

Add a collapse toggle in app shell.

Behavior:
- Expanded width: `w-64`
- Collapsed rail width: `w-16`
- Labels hide in collapsed mode; icons remain visible
- Tooltips show nav labels on hover when collapsed

### 2. Mobile Drawer Mode

On small screens, sidebar acts as off-canvas drawer.

Behavior:
- Opens from left with Tailwind transitions
- Overlay/backdrop closes drawer on click
- `Escape` closes drawer
- Focus trap while drawer is open

### 3. State Persistence

- Persist collapsed preference in `localStorage` key `sidebar_collapsed`
- Restore on app load
- Preference is local browser only (not server synced)

### 4. Tailwind-Only Implementation

- Implement layout and transitions using Tailwind utility classes
- Do not add new UI animation libraries
- Keep responsive breakpoints aligned with existing app shell

### 5. Accessibility

- Collapse toggle has `aria-label` and `aria-expanded`
- Drawer has `role="dialog"` and focus management
- Keyboard navigation remains functional in both modes

---

## File Checklist

| File | Change |
|------|--------|
| `src/layout/AppShell.tsx` | Add collapsed/drawer state orchestration |
| `src/layout/Sidebar.tsx` | Implement expanded, collapsed, and mobile drawer variants |
| `src/layout/TopBar.tsx` | Add drawer toggle button for mobile |
| `src/layout/hooks/useSidebarState.ts` | New persistent sidebar state hook |
| `src/index.css` | Add any required utility-layer styling hooks |
| `specs/tests/sidebar-collapsible-drawer.md` | Responsive and keyboard behavior tests |

---

## Acceptance Criteria

- [ ] Sidebar can be collapsed and expanded on desktop
- [ ] Collapsed mode keeps icons visible and labels hidden
- [ ] Mobile sidebar opens as a drawer with backdrop and close interactions
- [ ] Drawer closes with backdrop click and `Escape`
- [ ] Sidebar state is restored after page reload
- [ ] No layout shift breaks board and card pages in either mode

---

## Tests

```text
specs/tests/sidebar-collapsible-drawer.md
```
