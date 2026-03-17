# Sprint 82 - Rich Text Toolbar One-Line Overflow + Inline Attachments

> **Status:** Ready for development
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 11 (Comments & Activity), Sprint 21 (Comments, Activity & Attachments UI), Sprint 81 (Card Modal UI Overhaul)
> **References:** Card detail mockups (toolbar one-line + `+` command menu)

---

## Goal

Make rich text editing in both card description and comments match the new compact interaction model:

- Toolbar always stays on a single line
- Commands that do not fit are accessed from a `+` menu
- `+` menu supports search and action discovery (mention, emoji, code snippet, quote)
- Attachment action in editor shows inline upload feedback: image preview for images, file-name row for non-image files

---

## Scope

### 1. One-Line Rich Toolbar (Description + Comment)

Apply to:

- `CardDescriptionTiptap` (card description editor)
- `CommentEditor` (new comment + edit comment)

Behavior:

- Toolbar must not wrap to a second line
- Primary formatting controls remain directly visible as icon buttons
- Secondary actions are moved behind `+`

### 2. `+` Overflow Command Menu with Search

`+` opens a dropdown command list with a search field.

Required discoverable actions:

- Mention
- Emoji
- Code snippet
- Quote

Behavior:

- Typing in search filters command list by label/keywords
- Selecting a command executes it immediately and closes the menu
- If no command matches, show an empty-state message

### 3. Inline Attachment Feedback in Editors

Add attachment action to rich editor toolbar in both surfaces:

- Card description editor
- Comment editor

Behavior:

- User can pick one or multiple files
- While uploading:
  - image files show thumbnail preview + progress
  - non-image files show file name row + progress
- Upload row supports cancel while upload is in-flight
- Upload errors are shown inline below the editor controls

### 4. Card Context Wiring

Ensure card-scoped editors can upload attachments by passing `cardId` through card modal composition:

- Description editor receives `cardId`
- Comment editor in activity feed receives `cardId`
- Comment edit form receives `cardId`

---

## File Checklist

| File | Change |
|------|--------|
| `src/extensions/Comment/components/CommentEditor.tsx` | Single-line toolbar, `+` searchable command menu, editor attachment upload + upload preview rows |
| `src/extensions/Card/components/CardDescriptionTiptap.tsx` | Same one-line toolbar and `+` command behavior, plus inline upload preview rows |
| `src/extensions/Attachments/hooks/useAttachmentUpload.ts` | Expose completed attachment payload to caller callback |
| `src/extensions/Card/containers/CardModal/ActivityFeed.tsx` | Pass `cardId` to comment editor |
| `src/extensions/Comment/components/CommentItem.tsx` | Pass `card_id` to edit-comment editor |
| `src/extensions/Card/components/CardModal.tsx` | Pass `card.id` to description editor |
| `specs/tests/rich-text-toolbar-single-line-overflow.md` | Manual QA scenarios for toolbar overflow/search + attachment preview behavior |

---

## Acceptance Criteria

- [ ] Rich toolbar in comment editor always remains one line (no wrap)
- [ ] Rich toolbar in description editor always remains one line (no wrap)
- [ ] `+` menu is available in both editors and includes Mention, Emoji, Code snippet, Quote
- [ ] `+` menu includes search input and filters command list as the user types
- [ ] Uploading an image from either editor shows an inline image preview while upload is in progress
- [ ] Uploading a non-image from either editor shows the file name row while upload is in progress
- [ ] In-progress upload rows show status/progress and can be cancelled
- [ ] Upload errors are surfaced inline and do not break editing flow
- [ ] Existing save flows for description/comment continue to work unchanged

---

## Tests

```text
specs/tests/rich-text-toolbar-single-line-overflow.md
```
