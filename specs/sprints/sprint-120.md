# Sprint 120 — Theme Text & Contrast Consistency Audit

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 119 (Semantic Token Migration), Sprint 118 (Central Theme Design Token Config)
> **Status:** ⬜ Future

---

## Goal

After Sprint 119 migrates surface and button colours to semantic tokens, this sprint performs a **comprehensive audit focused on text legibility and contrast** across both light and dark themes. The goal is to ensure every text element in the UI — headings, body copy, placeholder text, labels, badges, tooltips, empty states, error messages, timestamps, and icon captions — renders with sufficient contrast and changes correctly when the theme is toggled.

This sprint also catches any residual hardcoded colours missed in Sprint 119, with a particular focus on cases where text becomes invisible or washed-out in one of the two themes (e.g. dark text on a dark background in dark mode, or light-grey text that disappears on a white background in light mode).

---

## Scope

---

### 1. What "Correct" Looks Like

| Text role | Light mode | Dark mode | Tailwind class |
|-----------|------------|-----------|----------------|
| Primary body / headings | `#0f172a` (slate-900) | `#f1f5f9` (slate-100) | `text-base` |
| Secondary / labels / captions | `#64748b` (slate-500) | `#94a3b8` (slate-400) | `text-muted` |
| Tertiary / timestamps / disabled | `#94a3b8` (slate-400) | `#64748b` (slate-500) | `text-subtle` |
| Text on primary-colour buttons | `#ffffff` | `#ffffff` | `text-white` |
| Text on light overlay surfaces (`bg-bg-surface`) | `text-base` | `text-base` | `text-base` |
| Placeholder text in inputs | `#94a3b8` | `#64748b` | `placeholder:text-subtle` |
| Links / clickable blue text | `#2563eb` (blue-600) | `#60a5fa` (blue-400) | `text-link` |
| Inline code / pre | slate-800 on slate-100 bg | slate-200 on slate-700 bg | handled by `@tailwindcss/typography` |
| Error messages | `#dc2626` (red-600) | `#ef4444` (red-500) | `text-danger` |
| Success messages | `#16a34a` (green-600) | `#22c55e` (green-500) | `text-success` |

---

### 2. Audit Checklist — UI Surfaces

Walk through every named screen (listed below) in **both light mode and dark mode**, checking each text category in the table above.

#### 2.1 Authentication

- [ ] Login page: form labels, input values, placeholder, error message, link text ("Forgot password?")
- [ ] Signup page: same + password hint text
- [ ] OAuth buttons: provider name text visible in both modes

#### 2.2 Workspace Dashboard

- [ ] Sidebar: workspace name, board names, section labels, icon labels
- [ ] Workspace switcher: member name, email address
- [ ] Boards grid: board title, member counter, last-updated timestamp

#### 2.3 Board View (Kanban)

- [ ] List header: list name, card count badge
- [ ] Card tile: card title, assignee display-name tooltip, label chip text, due-date badge, money badge
- [ ] Board header: board title, tab labels (Board / Table / Calendar / Timeline / Health Check)
- [ ] Board menu / `…` dropdown: all menu item labels

#### 2.4 Card Detail Modal

- [ ] Modal header: card title
- [ ] Section headings: "Description", "Checklist", "Activity", "Attachments", "Labels", "Members", "Due Date", "Value"
- [ ] Rich-text editor: body text, headings h1–h6, list items, blockquote, inline code, links
- [ ] Comment input: placeholder and submitted comment text
- [ ] Activity feed entries: event description, actor name, timestamp
- [ ] Checklist items: item text (unchecked and checked/strikethrough)
- [ ] Attachment rows: filename, URL, uploader name, timestamp
- [ ] Label chips: text inside coloured chips (contrast against the chip's background colour)
- [ ] Member avatars: tooltip showing display name

#### 2.5 Modals & Dropdowns

- [ ] Any modal title bar text
- [ ] Form labels and helper text
- [ ] Dropdown items: default and hover states
- [ ] Empty-state illustrations / copy inside dropdowns

#### 2.6 Notifications Panel

- [ ] Notification title and body text
- [ ] "Mark all read" link
- [ ] Timestamp ("2 min ago")
- [ ] Empty state text

#### 2.7 Profile & Settings Pages

- [ ] Section headings
- [ ] Field labels and values
- [ ] Read-only metadata (email, member since date)
- [ ] Destructive-action confirmation text

#### 2.8 Plugin / Automation / Extension Panels

- [ ] Any panel title, description text, table cell content
- [ ] Install/uninstall button labels inside panels

---

### 3. Common Failure Patterns to Look For

| Anti-pattern | Fix |
|--------------|-----|
| `text-white` on a `bg-bg-surface` container | Replace with `text-base` |
| `text-gray-400` hardcoded (not `text-subtle`) | Replace with `text-subtle` |
| Missing `dark:` variant after Sprint 119 left a raw class | Replace the raw class with a semantic token class |
| Input placeholder still default browser grey | Add `placeholder:text-subtle` to `<input>` |
| `<p className="">` with no text class | Add `text-base` |
| Link without colour class | Add `text-link hover:underline` |
| Error text as `text-red-500` (hardcoded) | Replace with `text-danger` |
| Success text as `text-green-500` (hardcoded) | Replace with `text-success` |
| Icon-only buttons with `text-gray-400` | Replace with `text-muted` |

---

### 4. Typography Scale Audit

Verify that heading hierarchy (`h1`–`h6` inside `.prose` and `ProseMirror`) is legible in both modes. The styles are defined in `src/index.css` — check that:

- `h6` uses `--text-muted` (not a fixed hex)
- No heading has a fixed colour that fails contrast in light mode
- `@tailwindcss/typography` `.prose` class adapts correctly (it has built-in dark-mode support when `prose-invert` is conditionally applied)

If `prose-invert` is not applied in dark mode, add it:

```tsx
// Conditionally apply prose-invert in dark mode (use the useTheme hook)
<div className={`prose max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
  {/* rendered markdown */}
</div>
```

---

### 5. Input & Form Element Consistency

All `<input>`, `<textarea>`, `<select>` elements must share a consistent appearance:

```tsx
// Recommended className for all text inputs
className="w-full bg-bg-overlay text-base placeholder:text-subtle border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
```

Check that no input has:
- A hardcoded `bg-gray-*` fill
- `text-white` that would be invisible in light mode
- Missing `placeholder:text-subtle`

---

### 6. Scrollbar & Non-React Surfaces

Ensure scrollbar styling (if custom) respects the theme. Add to `src/index.css` if not present:

```css
/* Themed scrollbars (WebKit) */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-overlay); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
```

---

## Verification

### Manual

1. Open the app with `.dark` on `<html>`. Walk through every screen in the checklist above — no text should be invisible or illegible.
2. Remove `.dark` from `<html>`. Walk through every screen again — no text should be invisible or illegible.
3. Toggle the theme while a card modal is open — all text inside the modal must change without a page reload.

### Automated (Playwright)

For each page in the checklist, add a basic contrast smoke test using Playwright's accessibility checker:

```ts
// tests/e2e/theme-contrast.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { name: 'login', path: '/login' },
  { name: 'workspace', path: '/workspace' },
  { name: 'board', path: '/board/:boardId' },
];

for (const { name, path } of pages) {
  test(`${name} passes axe contrast check in light mode`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();
    expect(results.violations.filter(v => v.id === 'color-contrast')).toHaveLength(0);
  });

  test(`${name} passes axe contrast check in dark mode`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();
    expect(results.violations.filter(v => v.id === 'color-contrast')).toHaveLength(0);
  });
}
```

Install `@axe-core/playwright` if not already in `package.json`.

---

## File Checklist

Files most likely to need changes in this sprint (discovered during the audit):

| Area | Common fix |
|------|------------|
| `src/layout/Sidebar.tsx` | Nav label `text-muted`, active state `text-base` |
| `src/containers/BoardPage/` | List header and card tile text tokens |
| `src/containers/CardModal/` | Section heading tokens, description prose |
| Rich-text viewer components | Add `prose-invert` toggle |
| All `<input>` / `<textarea>` components | Standardise to input template above |
| `src/index.css` | Add scrollbar styles, fix `h6` colour variable |

---

## Acceptance Criteria

1. Toggle theme on the running app — no text anywhere becomes invisible or unreadable in either mode.
2. All `<input>` and `<textarea>` elements show correct placeholder colour in both modes.
3. Rich-text / Markdown areas apply `prose-invert` in dark mode and `prose` in light mode.
4. The Playwright axe contrast tests pass for all pages in both modes.
5. `grep -rn 'text-white\b' src/` returns only lines inside coloured-background buttons or label chips (tagged with `// [theme-exception]`).
6. Scrollbars (where custom) visually match the active theme.
