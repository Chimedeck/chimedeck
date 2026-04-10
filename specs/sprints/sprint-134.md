# Sprint 134 — Design System Stylesheet Page

> **Depends on:** Sprint 133 (Button/IconButton centralisation complete), Sprint 15 (UI Foundation)
> **Status:** ⬜ Future

---

## Goal

Create a living design-system reference page at `/design-system` that documents every common UI component and design token implemented in the codebase. It serves as an always-up-to-date stylesheet guide for developers — no external Storybook or separate tooling required. The page is only accessible when the app runs with `NODE_ENV !== 'production'` or a `DESIGN_SYSTEM_ENABLED` feature flag is set to `true`.

---

## Scope

### 1. Feature flag

Add `DESIGN_SYSTEM_ENABLED` to `server/config/flags.ts` (or the env config module). Default: `false` in production, `true` in development.

The React client reads this flag from the app's `window.__ENV__` / API config response and gates the route registration.

---

### 2. Route

File: `src/extensions/DesignSystem/routes.ts`

```ts
export const DESIGN_SYSTEM_ROUTE = '/design-system';
```

Register in `src/routing/routes.tsx` conditionally:

```tsx
{designSystemEnabled && (
  <Route path="/design-system" element={<DesignSystemPage />} />
)}
```

No auth guard — accessible to anyone who can reach the dev instance. If auth is a concern, wrap behind the `isAdmin` check from `authSlice`.

---

### 3. Page structure

File: `src/extensions/DesignSystem/DesignSystemPage.tsx`

Single scrollable page with a sticky left nav (anchor links) and a main content column. Uses the existing app shell layout (`AppShell`) as a wrapper.

Sections (each with an `id` for anchor navigation):

| Anchor id | Section title |
|-----------|---------------|
| `colors` | Colour Tokens |
| `typography` | Typography |
| `buttons` | Buttons |
| `icon-button` | Icon Button |
| `badges` | Badges |
| `inputs` | Form Inputs |
| `alerts` | Alerts & Banners |
| `avatars` | Avatars |
| `modals` | Modals & Dialogs |
| `cards` | Card Tile & Labels |
| `comments` | Comments |
| `reactions` | Comment Reactions |
| `attachments` | Attachments |
| `notifications` | Notification Item |
| `tooltips` | Tooltips |
| `spinners` | Spinners & Loading States |
| `empty-states` | Empty States |

---

### 4. Colour Tokens section

Render a grid of colour swatches for every CSS custom property defined in `src/index.css`. Group by semantic category (background, text, border, status):

```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  bg-surface   │  │   bg-overlay  │  │  bg-sunken    │
│ var(--bg-…)   │  │               │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

Each swatch: `h-16 w-32 rounded-md border border-border` with the CSS var applied as inline `background` + the token name as a label below.

---

### 5. Typography section

Render `<h1>` through `<h6>`, body text (`text-base`, `text-sm`, `text-xs`), and muted / subtle colour classes. For each, show:
- The rendered text sample ("The quick brown fox…")
- The Tailwind class(es) used
- The resulting computed font-size and line-height

---

### 6. Buttons section

For each `ButtonVariant` × `ButtonSize` combination, render the button component with a label and show the Tailwind classes underneath:

```
primary   [lg]  [md]  [sm]  [icon]
secondary [lg]  [md]  [sm]  [icon]
ghost     [lg]  [md]  [sm]  [icon]
danger    [lg]  [md]  [sm]  [icon]
success   [lg]  [md]  [sm]  [icon]
link      [─]   [md]  [sm]  [─]
```

Also render disabled state for each variant at `md` size.

---

### 7. Icon Button section

Render `<IconButton>` in every combination of variant and size with a sample `HeroIcon` and an `aria-label`. Include a code snippet showing the import path.

---

### 8. Badges section

Show the label/chip variants used in the codebase (label colours from `src/extensions/Label/`, member role chips, status chips from attachments). Each badge: rendered + hex colour + Tailwind classes.

---

### 9. Form Inputs section

Render:
- Text input (default, focused, error, disabled states)
- Textarea
- Checkbox
- Radio group
- Select / dropdown

Use the field class conventions from existing form components. No new components are created — display what already exists.

---

### 10. Comments section

Embed a static (non-interactive) demo of `CommentItem` with:
- An avatar, display name, timestamp.
- Markdown body with a code block and a @mention chip.
- Edit + Delete action links.
- Reaction pills (👍 3, ❤️ 1) with one `reactedByMe` active.
- Reply count indicator ("View 2 replies").

Use hardcoded stub data — no API calls.

---

### 11. Comment Reactions section

Show `CommentReactions` in isolation with several stub emoji reactions including one `reactedByMe`. Clicking is wired (opens picker) but does not call the API (stub `onAdd`/`onRemove` log to console).

---

### 12. Remaining sections

Other sections (Avatars, Modals, Attachments, Notifications, Tooltips, Spinners, Empty States) follow the same pattern:
- Import the real component.
- Provide hardcoded stub props.
- No API calls.
- A `<code>` snippet showing the minimal import + usage.

---

### 13. Code snippet helper

File: `src/extensions/DesignSystem/components/CodeSnippet.tsx`

Renders a `<pre><code>` block with a copy-to-clipboard button. No syntax highlighting library — plain mono text in `bg-bg-sunken rounded p-3 text-xs font-mono`.

---

### 14. Section wrapper

File: `src/extensions/DesignSystem/components/Section.tsx`

```tsx
interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}
```

Renders `<section id={id}>` with a horizontal rule, large title, and the children. Provides consistent vertical rhythm.

---

### 15. Sticky sidebar nav

`nav` with `position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto`.
Links: `text-sm text-muted hover:text-base` anchors to each section `id`.

---

## Files Affected

```
src/extensions/DesignSystem/
  DesignSystemPage.tsx                   (new)
  routes.ts                              (new)
  components/
    Section.tsx                          (new)
    CodeSnippet.tsx                      (new)
    ColorSwatch.tsx                      (new)
    TypographySample.tsx                 (new)
src/routing/routes.tsx                   (modified — conditional route)
server/config/flags.ts                   (modified — DESIGN_SYSTEM_ENABLED)
```

---

## Acceptance Criteria

- [ ] Navigating to `/design-system` in development renders the page without errors.
- [ ] Page is NOT routed in production (`DESIGN_SYSTEM_ENABLED = false` by default in production config).
- [ ] All Button variants and sizes are visually represented.
- [ ] Colour swatches reflect the actual CSS custom properties in `src/index.css`.
- [ ] Comment and reaction sections render without any API calls (pure stub props).
- [ ] Copy button in `CodeSnippet` writes to clipboard.
- [ ] Sticky sidebar nav links scroll to the correct section.
- [ ] No TypeScript errors; no lint errors.

---

## Tests

No automated E2E tests for this sprint — this is a dev-only page. Verify manually in dev by visiting `/design-system` and checking each section renders correctly in both light and dark modes.
