# Sprint 119 — Semantic Token Migration (Replace Hardcoded Colours)

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 118 (Central Theme Design Token Config), Sprint 15 (UI Foundation)
> **Status:** ⬜ Future

---

## Goal

Replace every hardcoded Tailwind **colour utility** in `src/` with its semantic token equivalent introduced in Sprint 118. After this sprint, no component should reference raw palette classes like `bg-gray-800`, `bg-slate-700`, or `text-white` directly unless the context genuinely requires a fixed colour (e.g. a red-coloured label chip where red is the semantic meaning, not the theme layer).

The aim is that a single change to a CSS custom property in `src/index.css` propagates to the entire UI without touching any component.

---

## Scope

---

### 1. Replacement Rules

Use the table below as the migration guide when auditing and updating component files.

#### Backgrounds

| Hardcoded class (dark-first) | Semantic replacement |
|------------------------------|----------------------|
| `bg-gray-900`, `bg-slate-900`, `bg-zinc-900` | `bg-bg-base` |
| `bg-gray-800`, `bg-slate-800`, `bg-zinc-800` | `bg-bg-surface` |
| `bg-gray-700`, `bg-slate-700`, `bg-zinc-700` | `bg-bg-overlay` |
| `bg-gray-600`, `bg-slate-600`, `bg-zinc-600` | `bg-bg-sunken` |
| `dark:bg-gray-900` / `dark:bg-slate-900` | **Remove** — `bg-bg-base` resolves in both modes |
| `dark:bg-gray-800` / `dark:bg-slate-800` | **Remove** — `bg-bg-surface` resolves in both modes |
| Inline colour for modal overlays (`bg-black/50`) | Keep as-is — this is intentional fixed opacity |

#### Text

| Hardcoded class | Semantic replacement |
|-----------------|----------------------|
| `text-white` (on dark backgrounds) | `text-base` |
| `text-gray-100`, `text-slate-100` | `text-base` |
| `text-gray-400`, `text-slate-400`, `text-zinc-400` | `text-muted` |
| `text-gray-500`, `text-slate-500` | `text-muted` |
| `text-gray-300`, `text-slate-300` | `text-subtle` |
| `dark:text-white`, `dark:text-gray-100` | **Remove** — `text-base` resolves in both modes |
| `dark:text-gray-400` | **Remove** — `text-muted` resolves in both modes |
| Button text inside `bg-primary / bg-danger` buttons | `text-inverse` |

#### Borders

| Hardcoded class | Semantic replacement |
|-----------------|----------------------|
| `border-gray-700`, `border-slate-700` | `border-border` |
| `border-gray-200`, `border-slate-200` | `border-border` |
| `dark:border-gray-700` | **Remove** — `border-border` resolves in both modes |

#### Buttons

Any inline `className` that assembles button styles must be replaced with the `<Button>` component from `src/common/components/Button.tsx`. See the button migration guide below.

---

### 2. Button Migration Guide

Before (common ad-hoc pattern):
```tsx
<button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md">
  Save
</button>
```

After:
```tsx
import Button from '../../../common/components/Button';
// ...
<Button variant="primary" size="md">Save</Button>
```

Before (ghost / icon button):
```tsx
<button className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white">
  <XMarkIcon className="w-4 h-4" />
</button>
```

After:
```tsx
<Button variant="ghost" size="icon" aria-label="Close">
  <XMarkIcon className="w-4 h-4" />
</Button>
```

Before (danger):
```tsx
<button className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700">
  Delete
</button>
```

After:
```tsx
<Button variant="danger" size="md">Delete</Button>
```

---

### 3. Component Audit Scope

All files under `src/` are in scope. Priority order:

1. **`src/layout/`** — app shell, sidebar, top nav (highest visibility)
2. **`src/containers/`** — page-level containers (board view, card modal, workspace dashboard)
3. **`src/components/`** — shared UI components (modals, dropdowns, inputs)
4. **`src/extensions/`** — feature-specific components
5. **`src/pages/`** — login, signup, settings pages

For each file:
- Search for raw `bg-gray-*`, `bg-slate-*`, `bg-zinc-*`, `text-white`, `text-gray-*`, `text-slate-*`, `border-gray-*`, `border-slate-*` classes.
- Apply the replacement table above.
- Remove paired `dark:` overrides that are now redundant.
- Wrap bare `<button>` elements that carry colour styling in `<Button variant="...">`.

---

### 4. Exceptions (Do Not Replace)

These hardcoded classes are intentional and should remain:

| Pattern | Reason |
|---------|--------|
| Coloured label chips (e.g. `bg-green-500`, `bg-red-400`) | The colour IS the semantic meaning |
| Avatar / member colour rings | Colour encodes identity, not theme |
| `text-white` inside `bg-red-*` / `bg-green-*` label chips | Contrast against a fixed chip colour |
| `bg-black/50` modal backdrop | Intentional fixed opacity overlay |
| Inline styles that come from user data (board background) | Dynamic, not theme-controlled |

Document any new exceptions found during migration with an inline comment:
```tsx
{/* [theme-exception]: label chip — colour is semantic identity, not a theme surface */}
<span className="bg-green-500 text-white ...">
```

---

## Verification

After migration, run the following checks:

```bash
# Should return only intentional exceptions (label chips etc.) — NOT layout surfaces
grep -rn 'bg-gray-[0-9]\|bg-slate-[0-9]\|bg-zinc-[0-9]' src/ \
  | grep -v 'theme-exception' \
  | grep -v 'node_modules'

# Should be empty — no redundant dark: overrides for surfaces
grep -rn 'dark:bg-gray-\|dark:bg-slate-\|dark:text-white\|dark:text-gray-' src/ \
  | grep -v 'theme-exception'
```

Both commands should produce **zero output** (or only lines tagged `// [theme-exception]`).

---

## File Checklist

The specific files to update will be discovered during the audit. Expected hotspots based on current codebase patterns:

| Area | Files likely to change |
|------|------------------------|
| App shell | `src/layout/AppLayout.tsx`, `src/layout/Sidebar.tsx` |
| Board view | `src/containers/BoardPage/`, `src/extensions/Board/` |
| Card modal | `src/containers/CardModal/`, `src/extensions/Card/` |
| Auth pages | `src/pages/LoginPage.tsx`, `src/pages/SignupPage.tsx` |
| Shared components | `src/components/Modal.tsx`, `src/components/Dropdown.tsx` |
| Extensions | All files under `src/extensions/` |

---

## Acceptance Criteria

1. The grep verification commands above produce zero non-exception output.
2. In light mode (no `.dark` on `<html>`), the app renders with white/light-grey surfaces and dark text throughout — no dark panels visible.
3. In dark mode (`.dark` on `<html>`), the app renders identically to the pre-migration appearance.
4. All interactive buttons across the UI use `<Button variant="...">` or a component that internally delegates to `buttonVariants`.
5. No visual regression in dark mode — screenshots before and after should match for the dark theme.
