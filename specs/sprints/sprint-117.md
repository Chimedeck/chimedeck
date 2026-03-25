# Sprint 117 — Secure Attachment Proxy + Attachment Alias & Comment/Edit Actions

## Goal

Three tightly coupled improvements to the Attachments feature:

1. **Secure Attachment Proxy** — S3 presigned URLs are never exposed to the browser. All file/thumbnail access is routed through an authenticated API proxy endpoint (`/api/v1/attachments/:id/view` for files, `/api/v1/attachments/:id/thumbnail` for thumbnails). Shared links require the viewer to be authenticated; unauthenticated requests receive `401`.

2. **Attachment Alias (`alias` field)** — A new `alias` column on the `attachments` table lets users rename an attachment without touching the original filename. The original `name` is preserved forever. The UI display name, markdown rendering, and comment insertion all use `alias` when set; `name` is the fallback.

3. **Attachment Actions: Edit & Comment** — Each attachment row in `AttachmentItem` gains two new action buttons alongside the existing delete:
   - **Edit** — opens an inline rename input that saves to `alias`.
   - **Comment** — inserts a Markdown link `[alias or name](proxied-url)` into the card comment editor at the current cursor position.

---

## Acceptance Criteria

### Secure Proxy
- `GET /api/v1/attachments/:id/view` streams the S3 object back through the server (or redirects to a fresh very-short-lived presigned URL, ≤ 60 s). Requires authentication + board membership.
- `GET /api/v1/attachments/:id/thumbnail` does the same for `thumbnail_key`.
- `GET /api/v1/cards/:id/attachments` list response **no longer includes** `url` or `thumbnail_url` fields with raw S3 presigned links. Instead it includes `view_url` and `thumbnail_url` pointing to the proxy endpoints (e.g. `/api/v1/attachments/:id/view`).
- Direct S3 presigned URL is **never sent to the client** in any API response.
- URL-type attachments pass through unchanged (they are external URLs the user provided).
- Unauthenticated request to `/api/v1/attachments/:id/view` → `401`.
- Non-member request → `403`.
- PENDING / REJECTED attachments return appropriate status codes (202 / 422) as before.

### Alias Field
- Migration `0099_attachment_alias.ts` adds a nullable `alias` column (text) to `attachments`.
- `PATCH /api/v1/attachments/:id` (new endpoint) accepts `{ alias: string }`. Validates: non-empty string, max 255 chars. Returns the updated attachment row. Requires auth + board membership.
- List endpoint includes `alias` in every attachment row (`null` when not set).
- Attachment type definition adds `alias: string | null`.

### Edit Action
- `AttachmentItem` receives an `onRename: (id: string, alias: string) => void` prop (alongside existing `onDelete`).
- When **Edit** is clicked, the filename display becomes an inline `<input>` pre-filled with `alias ?? name`.
- On blur or Enter, calls `onRename` with the trimmed value; on Escape, cancels.
- Empty submission is rejected (no API call; input shakes or stays open).
- `AttachmentPanel` wires the `onRename` handler to the `PATCH /api/v1/attachments/:id` call.
- After save, the local attachment state is updated optimistically and confirmed on API success.

### Comment Action
- `AttachmentItem` receives an `onInsertComment: (markdown: string) => void` prop.
- When **Comment** is clicked, calls `onInsertComment` with the string:  
  `` `[{alias ?? name}]({view_url})` ``  
  (raw markdown, not rendered).
- `AttachmentPanel` / `CardModal` wires this to append/insert the markdown string into the active comment editor (the `CommentEditor` `ref` or a shared context value).
- No network call occurs on Comment click — it is a purely client-side insertion helper.

---

## Files

### Server
| File | Change |
|------|--------|
| `db/migrations/0099_attachment_alias.ts` | Add `alias` column to `attachments` |
| `server/extensions/attachment/api/view.ts` | New — proxy endpoint for file download |
| `server/extensions/attachment/api/thumbnail.ts` | New — proxy endpoint for thumbnail |
| `server/extensions/attachment/api/patch.ts` | New — `PATCH /api/v1/attachments/:id` for alias |
| `server/extensions/attachment/api/list.ts` | Remove presigned `url`/`thumbnail_url`; add `view_url`, `thumbnail_url` (proxy paths); include `alias` |
| `server/extensions/attachment/api/index.ts` | Register new routes |

### Client
| File | Change |
|------|--------|
| `src/extensions/Attachments/types.ts` | Add `alias: string \| null`, `view_url: string \| null` to `Attachment`; keep `url` for backwards compat |
| `src/extensions/Attachments/api.ts` | Add `patchAttachment({ id, alias })` helper |
| `src/extensions/Attachments/components/AttachmentItem.tsx` | Add Edit and Comment action buttons; inline rename input |
| `src/extensions/Attachments/components/AttachmentPanel.tsx` | Wire `onRename` and `onInsertComment` handlers |
| `src/extensions/Attachments/translations/en.json` | Keys for edit, rename placeholder, comment action labels |
| `src/extensions/Card/containers/CardModal/ActivityFeed.tsx` | Expose `insertMarkdown` callback for the Comment action |

---

## Security Note

The proxy approach eliminates information leakage: a user who copies a `view_url` link from the DOM and shares it with an unauthenticated party will receive a `401`. S3 bucket access remains private (no public-read policy required). The proxy adds latency only for the initial byte stream; for large files, the server may opt to 302-redirect to a very-short-lived (60 s) presigned URL so the client downloads directly from S3 — but the token is generated fresh on every authenticated request and is never persisted.

---

## Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| T1 | Unauthenticated GET `/attachments/:id/view` | 401 |
| T2 | Authenticated non-member GET `/attachments/:id/view` | 403 |
| T3 | Authenticated board member GET `/attachments/:id/view` of READY file | 200 or 302 (bytes stream or redirect) |
| T4 | List attachments response contains no raw S3 presigned URL | `url` field absent or null; `view_url` = `/api/v1/attachments/:id/view` |
| T5 | PATCH `/attachments/:id` with `{ alias: "My Report" }` | 200, `alias` = "My Report" |
| T6 | PATCH with empty alias | 400 |
| T7 | Edit action in UI — rename then press Escape | Alias unchanged |
| T8 | Edit action in UI — rename then press Enter | `onRename` called; row displays new alias |
| T9 | Comment action inserts `[alias](view_url)` markdown into editor | Markdown appears in comment box |
| T10 | Attachment with no alias shows original `name` everywhere | Display name = `name` |

---

## Dependencies

- Needs Sprint 12 (attachments base), Sprint 21 (attachment UI), Sprint 59 (enhanced backend), Sprint 60 (upload UI)

## Status

⬜ Future
