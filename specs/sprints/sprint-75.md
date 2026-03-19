# Sprint 75 — Light / Dark Theme (Full Implementation)

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 22 (Search, Presence & UI Polish — introduced the theme toggle scaffold), Sprint 15 (UI Foundation)

---

## Goal

The application is currently hard-wired to dark mode throughout. This sprint replaces hardcoded dark-only Tailwind classes with properly dual-mode equivalents across every component, ensuring the existing `ThemeToggle` (Sprint 22) produces a correct, polished light-mode experience. Light mode defaults to `false` (dark on first visit) but persists via `localStorage`. No new dependencies — relies purely on Tailwind's `darkMode: 'class'` strategy.

---

## Scope

### 1. Tailwind Configuration

**`tailwind.config.ts`** — verify/ensure:

```ts
export default {
  darkMode: 'class',   // must be 'class', not 'media'
  // ...
}
```

**`src/index.css`** — add CSS custom properties for the two palettes so non-Tailwind surfaces (scrollbars, third-party modals) also respond:

```css
:root {
  --bg-base:     #f8fafc;   /* slate-50 */
  --bg-surface:  #ffffff;
  --text-base:   #0f172a;   /* slate-900 */
  --border:      #e2e8f0;   /* slate-200 */
}

.dark {
  --bg-base:     #0f172a;   /* slate-900 */
  --bg-surface:  #1e293b;   /* slate-800 */
  --text-base:   #f1f5f9;   /* slate-100 */
  --border:      #334155;   /* slate-700 */
}
```

---

### 2. Theme Initialisation

**`src/main.tsx`** — apply saved theme before React renders to prevent flash of wrong theme:

```ts
const saved = localStorage.getItem('theme');
if (saved === 'light') {
  document.documentElement.classList.remove('dark');
} else {
  document.documentElement.classList.add('dark'); // default to dark
}
```

---

### 3. `useTheme` Hook (update)

**`src/common/hooks/useTheme.ts`**

```ts
export function useTheme(): { theme: 'dark' | 'light'; toggle: () => void } {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  return { theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') };
}
```

---

### 4. Component Audit — Light Mode Classes

Every component must use the `dark:` variant pattern rather than bare dark-only classes. The rule:

> Replace any standalone `bg-slate-900`, `bg-slate-800`, `text-slate-100`, `text-slate-400`, `border-slate-700`, `border-slate-800` etc. with the light-mode base class **plus** its `dark:` override.

#### Colour mapping reference

| Dark-only (current) | Light base | Dark override |
|---|---|---|
| `bg-slate-950` | `bg-white` | `dark:bg-slate-950` |
| `bg-slate-900` | `bg-slate-50` | `dark:bg-slate-900` |
| `bg-slate-800` | `bg-white` | `dark:bg-slate-800` |
| `bg-slate-700` | `bg-slate-200` | `dark:bg-slate-700` |
| `text-slate-100` | `text-slate-900` | `dark:text-slate-100` |
| `text-slate-300` | `text-slate-700` | `dark:text-slate-300` |
| `text-slate-400` | `text-slate-500` | `dark:text-slate-400` |
| `text-slate-500` | `text-slate-400` | `dark:text-slate-500` |
| `border-slate-800` | `border-slate-200` | `dark:border-slate-800` |
| `border-slate-700` | `border-slate-200` | `dark:border-slate-700` |
| `placeholder-slate-500` | `placeholder-slate-400` | `dark:placeholder-slate-500` |

#### Components to audit (non-exhaustive — update all that apply)

| File | Notes |
|---|---|
| `src/layout/Header/Header.tsx` | Nav bar background + text |
| `src/layout/Sidebar/Sidebar.tsx` | Sidebar background, item colours |
| `src/containers/WorkspaceDashboard/` | Boards grid, card tiles |
| `src/extensions/Board/components/BoardView.tsx` | Board background (the area behind columns — see Sprint 76 note below) |
| `src/extensions/Board/components/ListColumn.tsx` | **Column background must remain opaque / distinct regardless of board background** — `bg-slate-900/90 dark:bg-slate-900/90` (or equivalent light: `bg-white/90`) with `backdrop-blur-sm` so it reads clearly over any board image |
| `src/extensions/Card/components/CardItem.tsx` | Card tile |
| `src/extensions/Card/containers/CardDetailModal/` | Modal surface |
| `src/common/components/CommandPalette.tsx` | Palette panel |
| `src/common/components/Skeleton.tsx` | Pulse skeleton colours |
| `src/common/components/EmptyState.tsx` | Illustration + text colours |
| `src/extensions/Notifications/components/NotificationPanel/` | Notification panel |

---

### 5. `ThemeToggle` Component (update)

**`src/common/components/ThemeToggle.tsx`**

Switch icon: `SunIcon` (light mode) / `MoonIcon` (dark mode) from Heroicons.

```tsx
<button
  onClick={toggle}
  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
>
  {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
</button>
```

Placed in the Header right side, already wired in Sprint 22 — this sprint ensures the toggle actually produces a visually correct result.

---

### 6. Acceptance Criteria

- [ ] Toggling to light mode produces a white/slate-50 background on all pages with dark slate text — no dark surfaces remain
- [ ] Toggling back to dark mode restores the original dark appearance exactly
- [ ] Preference persists across page refreshes and browser restarts (localStorage)
- [ ] No flash of wrong theme on initial page load (theme applied before React hydration)
- [ ] List columns in the board view remain clearly legible in both modes, even when a board background image is present (Sprint 76)
- [ ] `ThemeToggle` button shows `SunIcon` in dark mode and `MoonIcon` in light mode with correct `aria-label`
- [ ] All Tailwind classes use the `dark:` variant pattern — no hardcoded dark-only classes remain
- [ ] Across all modals, dropdowns, and panels: correct colours in both modes
