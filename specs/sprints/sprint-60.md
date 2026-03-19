# Sprint 60 — Card Attachment Upload UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 59 (Enhanced attachment backend), Sprint 21 (Attachments UI baseline), Sprint 19 (Card Detail Modal)
> **References:** Sprint 59 API contract

---

## Goal

Deliver a polished attachment panel inside the card detail modal: drag-and-drop file drop zone, clipboard paste (Ctrl+V / Cmd+V for screenshots), multi-file selection, real-time upload progress bars, thumbnail previews for images, and inline delete confirmation.

---

## Scope

### 1. `src/extensions/Attachments/` (new folder)

```
src/extensions/Attachments/
  api.ts                         # RTK Query endpoints: list, uploadUrl, confirmUpload,
                                 #   multipart (start/partUrl/complete/abort), delete
  components/
    AttachmentPanel.tsx          # full panel rendered in card modal
    AttachmentDropZone.tsx       # drag-and-drop + file input trigger
    AttachmentItem.tsx           # single attachment row: icon, name, size, status, delete
    AttachmentThumbnail.tsx      # image preview card (uses thumbnailUrl if available)
    UploadProgressBar.tsx        # animated progress bar for in-flight uploads
    PasteListener.tsx            # invisible component, listens for clipboard paste events
  hooks/
    useAttachmentUpload.ts       # orchestrates single vs multipart upload logic
    useClipboardPaste.ts         # reads clipboard DataTransfer for image blobs
  utils/
    mimeIcon.ts                  # maps mimeType → Heroicon component (see §2)
    formatBytes.ts               # "48.2 KB", "12.5 MB"
  types.ts
```

---

### 2. Heroicons for File Type Badges

Use `@heroicons/react` (already in project) for file-type icons in `AttachmentItem` and `UploadProgressBar`:

| Category | Icon |
|----------|------|
| Image | `PhotoIcon` |
| PDF | `DocumentTextIcon` |
| Spreadsheet | `TableCellsIcon` |
| Archive | `ArchiveBoxIcon` |
| Video | `FilmIcon` |
| Audio | `MusicalNoteIcon` |
| Generic file | `DocumentIcon` |
| External URL | `LinkIcon` |
| Upload in-progress | `ArrowUpTrayIcon` |
| Delete | `TrashIcon` |

---

### 3. Drag-and-Drop Drop Zone

`AttachmentDropZone` wraps the attachment panel. When a file is dragged over the card modal:
- A full-panel overlay appears with a dashed border and `ArrowUpTrayIcon` icon
- Drop triggers `useAttachmentUpload` for each file
- Multiple files are queued and uploaded in parallel (max 3 concurrent)

---

### 4. Clipboard Paste

`PasteListener` listens on `document` while the card modal is open:
- On `paste` event with `image/*` in `DataTransfer.items`, extracts the blob
- Names it `pasted-image-<timestamp>.png`
- Calls `useAttachmentUpload` — same flow as a dropped file

---

### 5. Upload Flow (client orchestration)

`useAttachmentUpload` implements the following decision tree:

```
file.size <= 5 MB
  → POST /upload-url → PUT to S3 → POST /attachments (confirm)

file.size > 5 MB
  → POST /multipart/start
  → chunk file into 5 MB parts
  → parallel: POST /multipart/part-url, PUT to S3 for each part (up to 3 concurrent)
  → POST /multipart/complete { uploadId, parts }
```

Progress percentage: for single-file, use `XMLHttpRequest` `onprogress`; for multipart, track completed parts.

---

### 6. Card Modal Integration

Add an **Attachments** section to `CardDetailModal` (Sprint 19):

```tsx
// Inside CardDetailModal body:
<AttachmentPanel cardId={card.id} />
```

The panel renders:
1. Header: "Attachments" + `AttachmentDropZone` trigger button (uses `PaperClipIcon` Heroicon)
2. List of `AttachmentItem` rows (sorted: newest first)
3. Thumbnail grid below the list for `image/*` attachments

---

### 7. AttachmentItem Row

Each row shows:
- File-type Heroicon badge
- File name (truncated)
- File size (`formatBytes`)
- Status chip: "Uploading", "Scanning", "Ready", "Rejected"
- `UploadProgressBar` (visible only while uploading)
- Delete button (`TrashIcon`, opens inline confirmation)

Deleted files immediately removed from UI (optimistic mutation, rolled back on error).

---

### 8. External URL Attachment

A separate "Attach a link" form (below the file drop zone):
- Text input for URL + label
- `POST /api/v1/cards/:id/attachments` with `{ type: 'URL', url, name }`
- Renders as `AttachmentItem` with `LinkIcon` badge

---

## Acceptance Criteria

- [ ] Dragging a file onto the card modal triggers upload without clicking anything
- [ ] Pasting a screenshot (Cmd+V) starts an upload with a generated filename
- [ ] Upload progress is shown in real time; 100% transitions to "Scanning"
- [ ] Status transitions: "Scanning" → "Ready" or "Rejected" arrive via WebSocket
- [ ] Image attachments render a thumbnail preview (`thumbnailUrl`)
- [ ] Deleting an attachment requests confirmation ("Delete?") before removing
- [ ] External URL links render with `LinkIcon` and open in a new tab
- [ ] Disallowed MIME type shows a toast: "File type not allowed"
- [ ] File over 100 MB shows: "File is too large (max 100 MB)"

---

## Tests

- `tests/e2e/attachments/upload.spec.ts` — drag-and-drop, paste, and button-click upload flows
- `tests/e2e/attachments/delete.spec.ts` — delete confirmation flow
