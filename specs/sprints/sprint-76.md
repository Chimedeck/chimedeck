# Sprint 76 — Board Background Image Upload

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 46 (DB Schema: Board & Card Extensions — introduces `boards.background` column), Sprint 12 (Attachments — S3 upload), Sprint 05 (Board lifecycle API), Sprint 18 (Board View UI), Sprint 75 (Light / Dark Theme — column legibility requirement)

---

## Goal

Board owners and admins can upload a custom background image for any board. The image is stored in S3, and its URL is saved in the `boards.background` column (Sprint 46). The board view renders the image as a full-bleed background **behind** the columns only — list columns themselves remain visually unchanged with their opaque/semi-opaque surface. The uploaded background image is also used as the board's thumbnail in the workspace boards grid and the boards search results palette.

---

## Scope

### 1. S3 Upload Path

Background images are uploaded through the existing S3 flow (`server/extensions/attachment/`) with a dedicated prefix:

```
s3://bucket/board-backgrounds/{boardId}/{filename}
```

Images are stored as **public-read** objects (or via CloudFront CDN URL if configured). Contrast with card attachments which are signed-URL protected — backgrounds are always publicly renderable because they are decorative and non-sensitive.

Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif` (static gif only — animated blocked).  
Max upload size: **10 MB**.

---

### 2. Server — Background Upload Endpoint

**`server/extensions/board/api/uploadBackground.ts`**

```
POST /api/v1/boards/:id/background
```

- Authentication: JWT required. Caller must be `Owner` or `Admin` of the board's workspace.
- Body: `multipart/form-data` with a single `file` field.
- Validates MIME type and size. Returns `{ name: 'invalid-file-type' }` / `{ name: 'file-too-large' }` on failure.
- Uploads to S3 with public-read ACL.
- Updates `boards.background = <s3_public_url>` via `PATCH`.
- Emits a `board.background_changed` event (event sourcing — Sprint 09) so connected clients receive the change in real time.
- Returns `{ data: { background: '<url>' } }`.

**`server/extensions/board/api/deleteBackground.ts`**

```
DELETE /api/v1/boards/:id/background
```

- Resets `boards.background = null`.
- Deletes the S3 object.
- Emits `board.background_changed` with `background: null`.
- Returns `{ data: { background: null } }`.

---

### 3. Board API — include `background` in all board responses

`GET /api/v1/boards/:id` and `GET /api/v1/workspaces/:id/boards` already expose `background` (Sprint 46). Verify the upload/delete endpoints keep it updated and that the real-time WS event causes clients to re-render.

---

### 4. Board View — Background Rendering

**`src/extensions/Board/components/BoardView.tsx`**

The outermost wrapper of the board view is the element that receives the background. The column scroll container sits on top of it.

```tsx
// Outer wrapper — background only
<div
  className="relative flex-1 overflow-hidden"
  style={background ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
>
  {/* Optional dark/light scrim to improve column readability */}
  {background && (
    <div className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none" />
  )}

  {/* Horizontal scroll container — columns live here */}
  <div className="relative flex gap-3 overflow-x-auto p-4 h-full items-start">
    {lists.map(list => <ListColumn key={list.id} list={list} />)}
    <AddListButton />
  </div>
</div>
```

**Important:** The list columns (`ListColumn`) must **not** change — they retain their own background (`bg-slate-900/90 dark:bg-slate-900/90 backdrop-blur-sm` or equivalent per Sprint 75) so they remain fully legible over any background image or colour.

---

### 5. Board Settings UI — Background Picker

**`src/extensions/Board/components/BoardSettings/BackgroundPicker.tsx`**

Accessible from the board header `...` menu → **"Board settings"** → **"Background"** section.

Layout:

```
Background
──────────────────────────────────────────────
  Current: [thumbnail 80×50 px]  [Remove]

  Upload image
  [   Drop image here or click to browse   ]
  JPEG, PNG, WebP · Max 10 MB

  [Upload]
```

- File input (hidden) triggered by a styled drop zone (`DragEvent` + `input[type=file]`).
- Shows an inline preview of the selected file before uploading.
- Submits via `POST /api/v1/boards/:id/background` (`multipart/form-data`).
- Progress bar while uploading (reuse `UploadProgressBar` from Sprint 60 if available, otherwise a simple `<progress>` element).
- "Remove" button fires `DELETE /api/v1/boards/:id/background`.
- Only rendered for `Owner` / `Admin` roles; other roles see the current background but no upload controls.

---

### 6. Board Thumbnail in Workspace Grid + Search

**`src/containers/WorkspaceDashboard/BoardCard.tsx`**

When `board.background` is set, use it as the card's background image instead of the default gradient/solid colour:

```tsx
<div
  className="h-24 rounded-t-lg bg-cover bg-center"
  style={board.background ? { backgroundImage: `url(${board.background})` } : undefined}
/>
```

Fall back to the existing solid-colour or default gradient when `background` is `null`.

**`src/common/components/CommandPalette.tsx`** (search results — Sprint 22 / Sprint 77)

Board result rows gain a 32×20 px thumbnail in the leading position:

```tsx
{board.background ? (
  <img
    src={board.background}
    alt=""
    className="w-8 h-5 rounded object-cover flex-shrink-0"
  />
) : (
  <div className="w-8 h-5 rounded bg-slate-700 flex-shrink-0" />
)}
```

---

### 7. Real-Time Sync

When `board.background_changed` is received over WS:

- Update `boardSlice.entities[boardId].background` in Redux.
- `BoardView` re-renders the background immediately (React re-renders on state change).
- Other clients viewing the board see the new/removed background without refreshing.

---

### 8. Integration Tests

**`tests/integration/board/backgroundUpload.test.ts`**

| Scenario | Expected |
|---|---|
| `POST /api/v1/boards/:id/background` with valid JPEG (≤10 MB) | 200, `background` URL set in DB |
| Upload with invalid MIME type | 422, `name: 'invalid-file-type'` |
| Upload exceeding 10 MB | 413, `name: 'file-too-large'` |
| `DELETE /api/v1/boards/:id/background` | 200, `background` null in DB, S3 object deleted |
| Non-admin member attempts upload | 403 |

---

## Files

| Path | Change |
|---|---|
| `server/extensions/board/api/uploadBackground.ts` | New — multipart upload, S3, DB update, WS event |
| `server/extensions/board/api/deleteBackground.ts` | New — S3 delete, DB reset, WS event |
| `server/extensions/board/api/index.ts` | Mount new routes |
| `src/extensions/Board/components/BoardView.tsx` | Apply background image behind columns |
| `src/extensions/Board/components/BoardSettings/BackgroundPicker.tsx` | New upload/remove UI |
| `src/extensions/Board/components/ListColumn.tsx` | Ensure opaque column background (no change if already set in Sprint 75) |
| `src/containers/WorkspaceDashboard/BoardCard.tsx` | Use `background` as card thumbnail |
| `src/common/components/CommandPalette.tsx` | Add board thumbnail in search results |
| `tests/integration/board/backgroundUpload.test.ts` | New |

---

## Acceptance Criteria

- [ ] Board owner/admin can upload a JPEG/PNG/WebP (≤10 MB) as a board background image
- [ ] Background image fills the board view behind the columns only — columns are visually unchanged
- [ ] A semi-transparent scrim improves column readability over bright or busy background images
- [ ] Removing the background resets to the default appearance
- [ ] Non-admin members cannot upload or remove the background
- [ ] Uploaded background is used as the board thumbnail in the workspace grid
- [ ] Board search results in the command palette show the background thumbnail
- [ ] `board.background_changed` WS event causes other connected clients to update in real time
- [ ] Invalid MIME type and oversized files are rejected with the correct error name
