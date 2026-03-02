# Sprint 22 — Search, Presence & UI Polish

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprints 20–21, Sprint 13 (Search/Presence API), Sprint 14 (Hardening)  
> **References:** [requirements §§5.9, 5.10, 12, 13](../architecture/requirements.md)

---

## Goal

Deliver the final production-quality UI layer: a command-palette search (`⌘K`), live presence avatars on boards, dark/light theme toggle, empty states, loading skeletons, keyboard shortcuts, and a full accessibility pass. This sprint closes the gap between a working prototype and a shippable product.

---

## Scope

### 1. Command Palette (⌘K / Ctrl+K)

```
src/common/
  components/
    CommandPalette.tsx        # full-screen overlay search
    CommandPaletteResult.tsx  # single result row
```

Triggered by `⌘K` (Mac) / `Ctrl+K` (Windows) or clicking the search icon in `Header`.

Layout:
```
┌────────────────────────────────────────────┐
│  🔍  Search cards, boards, members…        │  ← input, autofocus
├────────────────────────────────────────────┤
│  BOARDS                                    │
│  📋  Q3 Roadmap · Acme Corp               │
│  📋  Website Redesign · Acme Corp         │
│                                            │
│  CARDS                                     │
│  ■  Fix login bug  ·  To Do  ·  Q3 Board  │
│  ■  Update README  ·  Done  ·  DevOps     │
│                                            │
│  esc to close  ·  ↑↓ to navigate  ·  ↵ to open
└────────────────────────────────────────────┘
```

Styling:
- Overlay: `fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[20vh] z-50`
- Panel: `w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden`
- Input: `w-full bg-transparent px-5 py-4 text-slate-100 placeholder-slate-500 text-lg focus:outline-none border-b border-slate-800`
- Result row: `flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-800 aria-selected:bg-slate-800 transition-colors`
- Category header: `px-5 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-950`

Behaviour:
- Debounce 200 ms → `GET /api/v1/search?q=<query>&workspaceId=<id>`
- Arrow keys navigate results; `Enter` navigates to the item; `Escape` closes
- Results include: cards (with list + board name), boards (with workspace name)
- Empty state: `"No results for '<query>'"` with a subtle illustration

### 2. Presence Avatars

```
src/extensions/Presence/
  components/
    BoardPresence.tsx         # live avatar stack in board header
    PresenceDot.tsx           # green/grey online indicator dot
  hooks/
    useBoardPresence.ts       # subscribes to WS presence events for board
```

- Board header shows avatars of users currently viewing the board
- Avatar tooltip on hover: `"<Name> is viewing"` — `bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1`
- Users not seen in last 30 s are shown with grey dot and 50% opacity
- Self avatar is always shown; own name shows `"(you)"`

### 3. Theme Toggle (Dark / Light)

```
src/common/
  components/
    ThemeToggle.tsx           # icon button in Header right side
  hooks/
    useTheme.ts               # reads/writes class on <html> element
```

- Default: dark (`class="dark"` on `<html>`)
- Toggle switches to light — all Tailwind classes use `dark:` variant
- Selection persisted in `localStorage`
- Light mode palette: `bg-white`, `bg-slate-50`, `text-slate-900`, `border-slate-200`

Key light-mode overrides in `tailwind.config.ts`:
```ts
darkMode: 'class'
```

### 4. Loading Skeletons

Replace all `"Loading…"` spinners with Tailwind pulse skeletons:

```
src/common/
  components/
    Skeleton.tsx              # base pulse block: animate-pulse bg-slate-800 rounded
    BoardSkeleton.tsx         # 3 column skeletons (list + 4 card blocks each)
    CardItemSkeleton.tsx      # single card chip skeleton
    WorkspaceSkeleton.tsx     # 4 workspace card skeletons
```

`BoardSkeleton`:
- 3 list columns side-by-side
- Each column: title bar skeleton + 4 card block skeletons
- Shown while `boardSlice.status === 'loading'`

### 5. Empty States

All empty states use a consistent pattern:

```
src/common/
  components/
    EmptyState.tsx            # illustration + title + description + optional CTA button
```

| Page / context | Illustration icon | Title | CTA |
|----------------|------------------|-------|-----|
| No boards | `LayoutGrid` | "No boards yet" | "+ Create board" |
| No cards in list | `StickyNote` | "No cards" | — |
| No search results | `SearchX` | "Nothing found" | — |
| No comments | `MessageCircle` | "No comments yet" | — |
| No activity | `Activity` | "No activity yet" | — |

### 6. Keyboard Shortcuts

Global shortcuts (captured in `App.tsx` via `useEffect`):

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| `N` (on board page) | Focus "Add card" in first list |
| `B` | Toggle sidebar |
| `Escape` | Close any open modal/palette |

Shortcut hint pill: `text-slate-500 text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-mono`

### 7. Accessibility Pass

- All interactive elements have visible `focus-visible:ring-2 focus-visible:ring-indigo-500` focus ring
- `aria-label` on icon-only buttons (e.g. close, drag handle)
- `role="dialog"` + `aria-modal="true"` on all modals
- Colour contrast ≥ 4.5:1 for all body text (verified with Tailwind's built-in palette)
- All drag-and-drop operations have keyboard alternatives (move card via modal "Move to list" action)
- `<title>` updates per route: e.g. `Q3 Roadmap — Kanban`

### 8. Acceptance Criteria

- [ ] `⌘K` opens command palette, typing filters results in real time
- [ ] Selecting a search result navigates to the correct board or opens the card modal
- [ ] Board header shows live presence avatars that update when another user joins or leaves
- [ ] Theme toggle switches between dark and light mode; preference survives reload
- [ ] Board view shows pulse skeletons while loading, not a blank screen
- [ ] All empty states render the correct illustration and message
- [ ] All modals are closeable by `Escape` key
- [ ] Lighthouse accessibility score ≥ 90 on the board page
- [ ] `<title>` reflects the current board name

### 9. Tests

```
specs/tests/
  search-command-palette.md   # Playwright: press ⌘K, type query, click result, verify navigation
  presence-avatars.md         # Playwright: two tabs open same board, verify avatar appears in tab 2 header
  theme-toggle.md             # Playwright: click theme toggle, verify light mode classes, reload, verify persisted
  keyboard-shortcuts.md       # Playwright: press N on board page, verify add-card input is focused
```

---

## Definition of Done for the Full UI Layer (Sprints 15–22)

- [ ] Full user journey works end-to-end: sign up → create workspace → create board → add lists and cards → drag cards → collaborate in real time
- [ ] No `console.error` in the browser for normal usage paths
- [ ] TypeScript compiles without errors (`bun run typecheck`)
- [ ] All Playwright spec tests pass
- [ ] Lighthouse Performance ≥ 80, Accessibility ≥ 90 on board page
- [ ] Mobile 375 px viewport usable without horizontal scroll on all pages
