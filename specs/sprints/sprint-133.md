# Sprint 133 — Design System: Replace Raw `<button>` Elements

> **Depends on:** Sprint 15 (UI Foundation — Button component exists)
> **Status:** ⬜ Future

---

## Goal

Centralise button usage across the codebase. Every interactive `<button>` element that currently has ad-hoc inline Tailwind classes should be replaced with either:

- **`<Button>`** — from `src/common/components/Button.tsx` — for click targets with visible body text or an icon + text label.
- **`<IconButton>`** — a new thin wrapper (added in this sprint) — for icon-only circular/square ghost action buttons (close ✕, collapse, scroll controls, etc.).

After this sprint, raw `<button>` usage is acceptable only in components where the `Button` / `IconButton` abstractions would add no value (e.g. custom editor toolbar items that carry their own rich state).

---

## Scope

### 1. Extend `Button` with a `link` variant

Some raw buttons function as inline text links (e.g. `hover:underline` action links in `CommentItem`). Add a semantic `link` variant:

File: `src/config/theme.ts` — add to `buttonVariants`:

```ts
link: 'bg-transparent text-muted underline-offset-2 hover:underline hover:text-base focus-visible:ring-2 focus-visible:ring-border disabled:opacity-50 disabled:cursor-not-allowed',
```

Add `'link'` to `ButtonVariant` type.

---

### 2. New `IconButton` component

File: `src/common/components/IconButton.tsx`

A focus-accessible icon-only button. Wraps `Button` with `variant="ghost"` and `size="icon"` by default, and requires `aria-label`.

```tsx
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'ghost', size = 'icon', className = '', ...props }, ref) => (
    <Button ref={ref} variant={variant} size={size} className={className} {...props} />
  )
);

IconButton.displayName = 'IconButton';
export default IconButton;
```

---

### 3. File-by-file replacements

Each raw `<button>` should be replaced with the appropriate component. Commentary explains the variant choice.

#### `src/extensions/Comment/components/CommentItem.tsx`

- Edit link (`hover:underline`) → `<Button variant="link" size="sm">`
- Delete link (`hover:underline hover:text-danger`) → `<Button variant="link" size="sm" className="hover:text-danger">`

#### `src/extensions/Attachment/components/AttachmentItem.tsx`

- Download button (styled with raw inline style) → `<Button variant="ghost" size="sm">`

#### `src/extensions/Attachment/components/AttachmentUrlModal.tsx`

- Cancel button → `<Button variant="secondary" size="md">`
- Submit button → `<Button variant="primary" size="md" type="submit">`

#### `src/extensions/Attachments/components/AttachmentItem.tsx`

- Delete cancel button → `<Button variant="ghost" size="sm">`

#### `src/extensions/Plugins/modals/RegisterPluginModal.tsx`

- Close ✕ button → `<IconButton aria-label={translations['plugins.registerModal.closeAriaLabel']}>`

#### `src/extensions/Plugins/modals/EditPluginModal.tsx`

- Close ✕ button → `<IconButton aria-label={translations['plugins.editModal.closeAriaLabel']}>`

#### `src/extensions/Card/containers/CardModal/index.tsx`

- Inline text "close" link → `<Button variant="link" size="sm">`

#### `src/extensions/Card/components/MemberAssignModal.tsx`

- Close ✕ button → `<IconButton aria-label="Close">`

#### `src/extensions/ApiToken/containers/ApiTokenPage/ApiTokenPage.tsx`

- Raw revoke button in token table row → `<Button variant="danger" size="sm">`

#### `src/extensions/Workspace/components/MemberList.tsx`

- Raw role/remove action button → `<Button variant="ghost" size="sm">`

#### `src/extensions/Workspace/containers/WorkspaceListPage/WorkspaceListPage.tsx`

- Create workspace buttons → `<Button variant="primary" size="md">` / `<Button variant="secondary" size="md">`

#### `src/extensions/Workspace/containers/AcceptInvitePage/AcceptInvitePage.tsx`

- Accept invite raw button → `<Button variant="primary" size="md">`

#### `src/extensions/Workspace/containers/WorkspacePage/WorkspacePage.tsx`

- Settings / action buttons → `<Button variant="secondary" size="sm">`

#### `src/extensions/Workspace/containers/WorkspaceDashboard/index.tsx`

- Contextual raw buttons → appropriate `Button` variant per visual role.

#### `src/extensions/Workspace/components/Sidebar.tsx`

- Nav item buttons, collapse toggle → `<Button variant="ghost" size="sm">` or `<IconButton>` for icon-only items.

#### `src/layout/Sidebar.tsx`

- Collapse/expand, nav items → `<IconButton>` for icon-only; `<Button variant="ghost">` for text items.

#### `src/layout/TopBar.tsx`

- Icon-only header actions → `<IconButton>`.

#### `src/common/monitoring/ErrorBoundary.tsx`

- Retry / dismiss buttons → `<Button variant="secondary" size="sm">`.

#### `src/extensions/List/components/ListHeader.tsx`

- Add card, rename, archive, delete inline buttons → `<Button variant="ghost" size="sm">` or `<IconButton>`.

#### `src/extensions/List/containers/BoardPage/ListColumn.tsx`

- Add card button → `<Button variant="ghost" size="sm">`.

#### `src/extensions/Auth/containers/ResetPasswordPage/ResetPasswordPage.tsx`

- Submit button → `<Button variant="primary" size="md" type="submit">`.

#### `src/extensions/TimelineView/TimelineView.tsx` and `TimelineZoomControl.tsx`

- Zoom & navigation buttons → `<IconButton>` with descriptive `aria-label`.

#### `src/extensions/TimelineView/TimelineRow.tsx`

- Inline action button → `<Button variant="ghost" size="sm">`.

#### `src/extensions/TableView/TableRow.tsx`

- Row action button → `<Button variant="ghost" size="sm">`.

#### `src/extensions/Notifications/NotificationPreferences/NotificationPreferencesPanel.tsx`

- Toggle or close button → `<IconButton>`.

#### `src/extensions/Plugins/uiInjections/CardPluginButtons.tsx`

- Plugin-injected buttons: leave as raw `<button>` if they carry plugin-specific dynamic classes that can't be expressed through the Button API — add a `// [plugin-button-exception]` comment instead of replacing.

---

### 4. Export `IconButton` from `src/common/components/index.ts`

Ensure `Button` and `IconButton` are both exported from the common components barrel so features can import from `~/common/components`.

---

### 5. Lint rule documentation

Add a comment in `eslint.config.js` noting that raw `<button>` is discouraged; point to `Button` / `IconButton`. Do not add an automated lint rule in this sprint (too noisy until the migration is complete).

---

## Files Affected

```
src/config/theme.ts                                                       (modified — link variant)
src/common/components/IconButton.tsx                                       (new)
src/common/components/index.ts                                             (modified — export IconButton)
src/extensions/Comment/components/CommentItem.tsx                          (modified)
src/extensions/Attachment/components/AttachmentItem.tsx                    (modified)
src/extensions/Attachment/components/AttachmentUrlModal.tsx                (modified)
src/extensions/Attachments/components/AttachmentItem.tsx                   (modified)
src/extensions/Plugins/modals/RegisterPluginModal.tsx                      (modified)
src/extensions/Plugins/modals/EditPluginModal.tsx                          (modified)
src/extensions/Card/containers/CardModal/index.tsx                         (modified)
src/extensions/Card/components/MemberAssignModal.tsx                       (modified)
src/extensions/ApiToken/containers/ApiTokenPage/ApiTokenPage.tsx           (modified)
src/extensions/Workspace/components/MemberList.tsx                         (modified)
src/extensions/Workspace/containers/WorkspaceListPage/WorkspaceListPage.tsx (modified)
src/extensions/Workspace/containers/AcceptInvitePage/AcceptInvitePage.tsx  (modified)
src/extensions/Workspace/containers/WorkspacePage/WorkspacePage.tsx        (modified)
src/extensions/Workspace/containers/WorkspaceDashboard/index.tsx           (modified)
src/extensions/Workspace/components/Sidebar.tsx                            (modified)
src/layout/Sidebar.tsx                                                     (modified)
src/layout/TopBar.tsx                                                      (modified)
src/common/monitoring/ErrorBoundary.tsx                                    (modified)
src/extensions/List/components/ListHeader.tsx                              (modified)
src/extensions/List/containers/BoardPage/ListColumn.tsx                    (modified)
src/extensions/Auth/containers/ResetPasswordPage/ResetPasswordPage.tsx     (modified)
src/extensions/TimelineView/TimelineView.tsx                               (modified)
src/extensions/TimelineView/TimelineZoomControl.tsx                        (modified)
src/extensions/TimelineView/TimelineRow.tsx                                (modified)
src/extensions/TableView/TableRow.tsx                                      (modified)
src/extensions/Notifications/NotificationPreferences/NotificationPreferencesPanel.tsx (modified)
eslint.config.js                                                           (modified — comment only)
```

---

## Acceptance Criteria

- [ ] `src/common/components/IconButton.tsx` is created and exported.
- [ ] `link` variant is added to `buttonVariants` and `ButtonVariant` type.
- [ ] All listed files no longer have uncategorised raw `<button>` elements (only `// [plugin-button-exception]` exceptions remain).
- [ ] Visual appearance of all replaced buttons is unchanged (verified by visual review).
- [ ] No TypeScript errors (`bun run type-check`).
- [ ] No lint errors (`bun run lint`).

---

## Tests

No new automated tests are required; this is a pure refactor. Visual regression can be verified manually or via existing Playwright flows that interact with the affected buttons. Verify that the following existing flows still pass:

- Login / Reset password flow (ResetPasswordPage button)
- Create workspace, accept invite flow
- Card modal open/close, comment edit/delete
- Attachment URL modal submit/cancel
- Plugin register/edit modal close
