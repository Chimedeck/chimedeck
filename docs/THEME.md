# Theme Customisation

All visual tokens (colours, surfaces, borders, typography) are controlled from three files. Edit only `src/index.css` for colour changes — the other two files rarely need touching.

---

## File Overview

| File | Purpose |
|---|---|
| `src/index.css` | **Single source of truth.** CSS custom properties for light and dark mode. |
| `tailwind.config.ts` | Maps CSS variables to Tailwind class names. |
| `src/config/theme.ts` | Button variant class strings for React components. |

---

## Changing Colours (`src/index.css`)

The file has two blocks:

- `:root { ... }` — light mode values
- `.dark { ... }` — dark mode values (applied when the `dark` class is on `<html>`)

Edit the hex value on the right side of each variable. The comment next to each line shows the nearest Tailwind colour swatch for reference.

```css
:root {
  /* ── Brand ─────────────────────────────── */
  --color-primary:       #2563eb;   /* blue-600 */
  --color-primary-hover: #1d4ed8;   /* blue-700 */
  --color-secondary:     #64748b;   /* slate-500 */
  --color-accent:        #0ea5e9;   /* sky-500 */

  /* ── Surfaces ───────────────────────────── */
  --bg-base:     #f8fafc;   /* page background */
  --bg-surface:  #ffffff;   /* cards, modals, panels */
  --bg-overlay:  #f1f5f9;   /* hover rows, inner blocks */
  --bg-sunken:   #e2e8f0;   /* input fills, code blocks */

  /* ── Text ───────────────────────────────── */
  --text-base:    #0f172a;  /* primary body text */
  --text-muted:   #64748b;  /* secondary / placeholder */
  --text-subtle:  #94a3b8;  /* disabled, timestamps */
  --text-inverse: #ffffff;  /* text on dark/coloured backgrounds */
  --text-link:    #2563eb;  /* links */

  /* ── Borders ────────────────────────────── */
  --border:        #e2e8f0;
  --border-strong: #cbd5e1;  /* focused inputs */

  /* ── Semantic ───────────────────────────── */
  --color-danger:   #dc2626;
  --color-success:  #16a34a;
  --color-warning:  #d97706;
  --color-info:     #0284c7;
}
```

Repeat for `.dark { ... }` with appropriate darker/lighter counterparts.

### Example — swap primary from blue to indigo

```css
:root {
  --color-primary:       #4f46e5;   /* indigo-600 */
  --color-primary-hover: #4338ca;   /* indigo-700 */
}

.dark {
  --color-primary:       #6366f1;   /* indigo-500 */
  --color-primary-hover: #4f46e5;   /* indigo-600 */
}
```

---

## Token Reference

### Brand

| Variable | Light default | Usage |
|---|---|---|
| `--color-primary` | `#2563eb` | Primary buttons, active states, focus rings |
| `--color-primary-hover` | `#1d4ed8` | Hover state of primary elements |
| `--color-secondary` | `#64748b` | Secondary buttons, subdued accents |
| `--color-accent` | `#0ea5e9` | Highlights, badges, callouts |

### Surfaces

| Variable | Light default | Usage |
|---|---|---|
| `--bg-base` | `#f8fafc` | Page / app background |
| `--bg-surface` | `#ffffff` | Cards, modals, panels |
| `--bg-overlay` | `#f1f5f9` | Hover rows, inner blocks |
| `--bg-sunken` | `#e2e8f0` | Input fills, code blocks |

### Text

| Variable | Light default | Usage |
|---|---|---|
| `--text-base` | `#0f172a` | Primary body text |
| `--text-muted` | `#64748b` | Secondary / placeholder text |
| `--text-subtle` | `#94a3b8` | Disabled states, timestamps |
| `--text-inverse` | `#ffffff` | Text on coloured / dark backgrounds |
| `--text-link` | `#2563eb` | Hyperlinks and link-style buttons |

### Borders

| Variable | Light default | Usage |
|---|---|---|
| `--border` | `#e2e8f0` | Default borders, dividers |
| `--border-strong` | `#cbd5e1` | Focused inputs, stronger dividers |

### Semantic

| Variable | Light default | Usage |
|---|---|---|
| `--color-danger` | `#dc2626` | Errors, destructive actions |
| `--color-success` | `#16a34a` | Success states, confirmations |
| `--color-warning` | `#d97706` | Warnings, caution banners |
| `--color-info` | `#0284c7` | Informational banners |

---

## Tailwind Class Names (`tailwind.config.ts`)

The variables above are mapped to Tailwind utility classes. These mappings rarely need changing — only edit if you add or rename a token.

| Tailwind class | CSS variable |
|---|---|
| `bg-primary` / `text-primary` | `--color-primary` |
| `bg-bg-surface` | `--bg-surface` |
| `text-base` | `--text-base` |
| `text-muted` | `--text-muted` |
| `text-subtle` | `--text-subtle` |
| `text-link` | `--text-link` |
| `border-border` | `--border` |
| `bg-danger` / `text-danger` | `--color-danger` |

---

## Button Variants (`src/config/theme.ts`)

Button styles are centralised here so components stay free of ad-hoc Tailwind strings. To change a button style, edit the class string for the relevant variant.

```ts
export const buttonVariants = {
  primary:   'bg-primary text-white hover:bg-primary-hover ...',
  secondary: 'bg-bg-overlay text-base border border-border ...',
  ghost:     'bg-transparent text-muted hover:bg-bg-overlay ...',
  danger:    'bg-danger text-white hover:opacity-90 ...',
  success:   'bg-success text-white hover:opacity-90 ...',
};
```

Sizes (`lg`, `md`, `sm`, `icon`) are also defined here and control padding, font size, and border radius.

---

## Dark Mode

Dark mode is toggled by adding/removing the `dark` class on the `<html>` element. The toggle button in the top bar handles this automatically. All `.dark` overrides live in `src/index.css` alongside the light-mode `:root` block.
