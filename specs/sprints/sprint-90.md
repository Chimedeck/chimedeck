# Sprint 90 — i18n Phase 1: Comment, Activity & Attachment Extensions

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 11 (Comments & Activity), Sprint 12 (Attachments), Sprint 21 (Comments/Attachments UI)
> **References:** Existing pattern in `src/extensions/Card/translations/en.json`

---

## Goal

Extract all hard-coded English strings from the **Comment**, **Activity**, and **Attachment / Attachments** extensions into per-feature `translations/en.json` files. Components import the JSON directly (no library), matching the pattern already established in `Card`, `Board`, and `Auth`.

This is Phase 1 of a multi-sprint i18n effort. Starting with these three tightly coupled extensions keeps the blast radius small while proving the extraction workflow that subsequent sprints will follow.

---

## Background: Translation Pattern

The project uses a zero-library static-import approach:

```ts
import translations from '../translations/en.json';
// usage:
<p>{translations['Comment.placeholder']}</p>
```

No `react-i18next`, no `IntlProvider`. Each feature owns its `translations/en.json`. This sprint follows the same convention.

---

## Scope

### 1. Comment Extension

**New file:** `src/extensions/Comment/translations/en.json`

Cover all UI strings inside `src/extensions/Comment/` components, including:

| Key | English value |
|-----|--------------|
| `Comment.addPlaceholder` | `Add a comment…` |
| `Comment.editPlaceholder` | `Edit comment…` |
| `Comment.saveButton` | `Save` |
| `Comment.cancelButton` | `Cancel` |
| `Comment.deleteButton` | `Delete` |
| `Comment.deleteConfirm` | `Delete this comment?` |
| `Comment.editLabel` | `Edit` |
| `Comment.threadTitle` | `Comments` |
| `Comment.emptyState` | `No comments yet` |
| `Comment.ariaClose` | `Close comment editor` |

Update all components in `src/extensions/Comment/` to import and use `translations['…']` instead of inline strings.

---

### 2. Activity Extension

**New file:** `src/extensions/Activity/translations/en.json`

Cover all display strings in activity feed items, labels, and empty states:

| Key | English value |
|-----|--------------|
| `Activity.feedTitle` | `Activity` |
| `Activity.emptyState` | `No activity yet` |
| `Activity.loadMore` | `Load more` |
| `Activity.filterAll` | `All` |
| `Activity.filterComments` | `Comments` |
| `Activity.filterEvents` | `Events` |
| `Activity.today` | `Today` |
| `Activity.yesterday` | `Yesterday` |
| `Activity.ariaFilterMenu` | `Filter activity` |

Update all components in `src/extensions/Activity/` to use the translation object.

---

### 3. Attachment / Attachments Extension

**New file:** `src/extensions/Attachment/translations/en.json`  
**New file:** `src/extensions/Attachments/translations/en.json` (if separate folder exists)

| Key | English value |
|-----|--------------|
| `Attachment.sectionTitle` | `Attachments` |
| `Attachment.addButton` | `Add Attachment` |
| `Attachment.uploadLabel` | `Upload a file` |
| `Attachment.linkLabel` | `Attach a link` |
| `Attachment.linkPlaceholder` | `Paste a URL…` |
| `Attachment.linkNamePlaceholder` | `Link name (optional)` |
| `Attachment.deleteButton` | `Remove` |
| `Attachment.deleteConfirm` | `Remove this attachment?` |
| `Attachment.downloadLabel` | `Download` |
| `Attachment.editNameLabel` | `Edit name` |
| `Attachment.namePlaceholder` | `Attachment name…` |
| `Attachment.ariaClose` | `Close attachment panel` |
| `Attachment.uploadProgress` | `Uploading…` |
| `Attachment.errorUpload` | `Upload failed. Please try again.` |
| `Attachment.errorLink` | `Invalid URL.` |

Update all components in `src/extensions/Attachment/` and `src/extensions/Attachments/` to use the translation object.

---

## File Checklist

| File | Change |
|------|--------|
| `src/extensions/Comment/translations/en.json` | **Create** — all comment UI strings |
| `src/extensions/Activity/translations/en.json` | **Create** — all activity UI strings |
| `src/extensions/Attachment/translations/en.json` | **Create** — all attachment UI strings |
| `src/extensions/Attachments/translations/en.json` | **Create** — if folder is separate from Attachment |
| `src/extensions/Comment/components/*.tsx` | Update — replace inline strings with `translations['…']` |
| `src/extensions/Activity/components/*.tsx` | Update — replace inline strings with `translations['…']` |
| `src/extensions/Attachment/components/*.tsx` | Update — replace inline strings with `translations['…']` |
| `src/extensions/Attachments/components/*.tsx` | Update — replace inline strings with `translations['…']` |

---

## Acceptance Criteria

- [ ] `src/extensions/Comment/translations/en.json` exists and covers all user-visible strings in Comment components
- [ ] `src/extensions/Activity/translations/en.json` exists and covers all user-visible strings in Activity components
- [ ] `src/extensions/Attachment/translations/en.json` (and `Attachments/` if applicable) exists and covers all user-visible strings
- [ ] No hardcoded English strings remain in any `.tsx` file within the three extension folders (labels, placeholders, `aria-label`, button text, empty states)
- [ ] Components use `translations['Key']` bracket notation, consistent with existing extensions
- [ ] No new i18n library is introduced — static JSON import only
- [ ] All existing Comment, Activity, and Attachment UI behaviour is unchanged after the refactor
