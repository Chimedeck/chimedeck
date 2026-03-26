# Sprint 118 — Central Theme Design Token Config

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 15 (UI Foundation)
> **Status:** ⬜ Future

---

## Goal

Establish a **single source of truth for all visual design tokens** — brand colours, surface colours, text colours, border colours, and standardised button variants (primary / secondary / ghost / danger, each in large and normal sizes). Currently Tailwind colour classes are scattered across components with no enforced semantic layer; this sprint creates the foundation so every subsequent UI change draws from one config rather than hardcoded palette values.

This sprint is intentionally non-breaking: it introduces the token layer and a reusable `Button` component without touching existing component classes. Sprints 119 and 120 perform the migration and audit.

---

## Scope

---

### 1. CSS Custom Properties — `src/index.css`

Extend the existing `:root` / `.dark` blocks to cover **all** design tokens. Replace the current minimal 4-variable set with the full palette below.

```css
/* src/index.css */

:root {
  /* ── Brand ─────────────────────────────────────────── */
  --color-primary:       #2563eb;   /* blue-600 */
  --color-primary-hover: #1d4ed8;   /* blue-700 */
  --color-secondary:     #64748b;   /* slate-500 */
  --color-accent:        #0ea5e9;   /* sky-500 */

  /* ── Surfaces ───────────────────────────────────────── */
  --bg-base:     #f8fafc;   /* slate-50  — page background */
  --bg-surface:  #ffffff;   /* cards, modals, panels */
  --bg-overlay:  #f1f5f9;   /* slate-100 — hover rows, inner blocks */
  --bg-sunken:   #e2e8f0;   /* slate-200 — input fills, code blocks */

  /* ── Text ───────────────────────────────────────────── */
  --text-base:    #0f172a;  /* slate-900 — primary body text */
  --text-muted:   #64748b;  /* slate-500 — secondary / placeholder */
  --text-subtle:  #94a3b8;  /* slate-400 — disabled, timestamps */
  --text-inverse: #ffffff;  /* text on dark/coloured backgrounds */
  --text-link:    #2563eb;  /* blue-600  — links */

  /* ── Borders ────────────────────────────────────────── */
  --border:       #e2e8f0;  /* slate-200 */
  --border-strong:#cbd5e1;  /* slate-300 — focused inputs */

  /* ── Semantic ───────────────────────────────────────── */
  --color-danger:   #dc2626;  /* red-600   */
  --color-success:  #16a34a;  /* green-600 */
  --color-warning:  #d97706;  /* amber-600 */
  --color-info:     #0284c7;  /* sky-700   */
}

.dark {
  /* ── Brand ─────────────────────────────────────────── */
  --color-primary:       #3b82f6;   /* blue-500 */
  --color-primary-hover: #2563eb;   /* blue-600 */
  --color-secondary:     #94a3b8;   /* slate-400 */
  --color-accent:        #38bdf8;   /* sky-400  */

  /* ── Surfaces ───────────────────────────────────────── */
  --bg-base:     #0f172a;   /* slate-900 */
  --bg-surface:  #1e293b;   /* slate-800 */
  --bg-overlay:  #334155;   /* slate-700 */
  --bg-sunken:   #475569;   /* slate-600 */

  /* ── Text ───────────────────────────────────────────── */
  --text-base:    #f1f5f9;  /* slate-100 */
  --text-muted:   #94a3b8;  /* slate-400 */
  --text-subtle:  #64748b;  /* slate-500 */
  --text-inverse: #0f172a;  /* slate-900 — text on light backgrounds */
  --text-link:    #60a5fa;  /* blue-400  */

  /* ── Borders ────────────────────────────────────────── */
  --border:       #334155;  /* slate-700 */
  --border-strong:#475569;  /* slate-600 */

  /* ── Semantic ───────────────────────────────────────── */
  --color-danger:   #ef4444;  /* red-500   */
  --color-success:  #22c55e;  /* green-500 */
  --color-warning:  #f59e0b;  /* amber-500 */
  --color-info:     #38bdf8;  /* sky-400   */
}
```

> **Rule:** no `.dark` override is needed for semantic colours (danger / success / warning) in components once these variables are defined — the CSS variable resolves to the correct shade automatically.

---

### 2. Tailwind Config — `tailwind.config.ts`

Register semantic colour aliases so they are available as Tailwind utility classes (e.g. `bg-primary`, `text-muted`, `border-border`).

```ts
import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Brand */
        primary:         'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        secondary:       'var(--color-secondary)',
        accent:          'var(--color-accent)',

        /* Surfaces */
        'bg-base':     'var(--bg-base)',
        'bg-surface':  'var(--bg-surface)',
        'bg-overlay':  'var(--bg-overlay)',
        'bg-sunken':   'var(--bg-sunken)',

        /* Borders */
        border:          'var(--border)',
        'border-strong': 'var(--border-strong)',

        /* Semantic */
        danger:   'var(--color-danger)',
        success:  'var(--color-success)',
        warning:  'var(--color-warning)',
        info:     'var(--color-info)',
      },
      textColor: {
        base:    'var(--text-base)',
        muted:   'var(--text-muted)',
        subtle:  'var(--text-subtle)',
        inverse: 'var(--text-inverse)',
        link:    'var(--text-link)',
      },
    },
  },
  plugins: [typography],
};

export default config;
```

> Semantic text colours are registered under `textColor` so they are usable as `text-base`, `text-muted`, `text-subtle`, `text-inverse`, `text-link` without colliding with Tailwind's built-in colour palette.

---

### 3. Theme Config Module — `src/config/theme.ts`

A TypeScript file exporting the button variant class strings. This is the **single place** to change button appearance for the whole app.

```ts
// src/config/theme.ts
// Central design token reference for React components.
// CSS custom properties live in src/index.css.
// Tailwind aliases live in tailwind.config.ts.
// Button class strings are defined here so components stay free of ad-hoc styling.

export const buttonVariants = {
  // ── Solid variants ──────────────────────────────────────
  primary:
    'bg-primary text-white hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-bg-overlay text-base border border-border hover:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-muted hover:bg-bg-overlay hover:text-base focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-danger text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  success:
    'bg-success text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',

  // ── Sizes ────────────────────────────────────────────────
  lg:   'px-6 py-3 text-base font-semibold rounded-lg',
  md:   'px-4 py-2 text-sm font-medium rounded-md',
  sm:   'px-3 py-1.5 text-xs font-medium rounded',
  icon: 'p-2 rounded-md',        // square icon-only button
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize    = 'lg' | 'md' | 'sm' | 'icon';
```

---

### 4. Reusable `Button` Component — `src/common/components/Button.tsx`

A thin wrapper that composes `buttonVariants` entries. All new code must use this component rather than assembling button classes inline.

```tsx
// src/common/components/Button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { buttonVariants, type ButtonVariant, type ButtonSize } from '../../config/theme';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none';
    const variantClasses = buttonVariants[variant];
    const sizeClasses = buttonVariants[size];
    return (
      <button
        ref={ref}
        className={`${base} ${variantClasses} ${sizeClasses} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export default Button;
```

---

## File Checklist

| File | Action |
|------|--------|
| `src/index.css` | Replace `:root` / `.dark` with the full token set above |
| `tailwind.config.ts` | Add semantic `colors` + `textColor` extensions |
| `src/config/theme.ts` | Create — `buttonVariants`, `ButtonVariant`, `ButtonSize` exports |
| `src/common/components/Button.tsx` | Create — composable Button using `buttonVariants` |

---

## Acceptance Criteria

1. `src/index.css` `:root` block defines all 20+ custom properties; `.dark` block overrides all of them.
2. Running `grep -r 'var(--color-primary)' src/` returns at least the `tailwind.config.ts` reference.
3. `src/config/theme.ts` exports `buttonVariants`, `ButtonVariant`, `ButtonSize`.
4. `<Button variant="primary" size="lg">` renders with primary colour background and large padding; toggling `.dark` on `<html>` visually changes the colour with no component code change.
5. `<Button variant="danger">` renders red; `<Button variant="ghost">` renders with transparent background.
6. No existing component is broken — this sprint only adds new files and extends config.

---

## What This Sprint Does NOT Do

- Does **not** migrate existing components to use the new tokens (that is Sprint 119).
- Does **not** audit text contrast across themes (that is Sprint 120).
- Does **not** introduce a runtime theme switcher (that is Sprint 75, which should depend on this sprint).
