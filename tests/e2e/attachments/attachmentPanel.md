# Attachment Panel — Playwright MCP Tests

## Setup

- Navigate to the board page (e.g. `/board/test-board-id`)
- Open a card by clicking its title
- Verify the card detail modal is open
- Verify the "Attachments" section is visible in the modal body

---

## Test 1 — Attach file via button click

1. In the card modal, locate the "Attach file" button (has `data-testid="attach-file-button"`)
2. Click the "Attach file" button
3. A native file picker dialog opens
4. Select a PNG image file (≤ 5 MB) from the local file system
5. Verify a new row appears in `[data-testid="attachment-list"]` immediately
6. Verify the row shows the file name and an "Uploading" status chip
7. Wait for the progress bar to reach 100 % and disappear
8. Verify the status chip transitions to "Ready"

---

## Test 2 — Drag-and-drop file upload

1. Open the card detail modal
2. Drag a file (e.g. `sample.pdf`) from the OS file manager and hover it over the modal
3. Verify a full-panel overlay appears with a dashed blue border and the upload arrow icon
4. Drop the file onto the overlay
5. Verify the overlay disappears immediately after drop
6. Verify a new attachment row appears in `[data-testid="attachment-list"]` with status "Uploading"
7. Wait for upload to complete
8. Verify the row now shows status "Ready"

---

## Test 3 — Paste screenshot (clipboard)

1. Open the card detail modal
2. Copy an image to the OS clipboard (e.g. press `Cmd+Shift+4` / `Print Screen` on a region)
3. While the modal is focused, press `Cmd+V` (macOS) or `Ctrl+V` (Windows/Linux)
4. Verify a new attachment row appears with a name matching `pasted-image-<timestamp>.png`
5. Verify the status shows "Uploading" then transitions to "Ready"

---

## Test 4 — Upload progress bar

1. Open the card detail modal
2. Attach a large file (> 1 MB) via the file picker
3. While the file is uploading, verify the `UploadProgressBar` is visible inside the attachment row
4. Verify the progress bar percentage increases over time
5. Verify the progress bar disappears once the upload reaches 100 % and status is "Ready"

---

## Test 5 — Delete attachment with confirmation

1. Open the card detail modal with at least one "Ready" attachment
2. Click the trash icon (`TrashIcon`) on the attachment row
3. Verify an inline "Delete?" confirmation appears with "Yes" and "No" buttons
4. Click "Yes"
5. Verify the attachment row is removed from `[data-testid="attachment-list"]` immediately (optimistic)
6. Verify the attachment no longer appears after refreshing the card modal

---

## Test 6 — Cancel delete confirmation

1. Open the card detail modal with at least one "Ready" attachment
2. Click the trash icon on an attachment row
3. Verify the inline "Delete?" confirmation appears
4. Click "No"
5. Verify the confirmation disappears and the attachment row remains in the list

---

## Test 7 — Attach external URL

1. Open the card detail modal
2. Click the "Attach a link" button (`data-testid="attach-link-button"`)
3. Verify the link form appears (`data-testid="link-form"`)
4. Type `https://www.example.com` in the URL field (`data-testid="link-url-input"`)
5. Type `Example Website` in the display name field (`data-testid="link-name-input"`)
6. Click the "Attach" button (`data-testid="link-submit-button"`)
7. Verify the form closes
8. Verify a new attachment row appears with name "Example Website" and a link icon
9. Clicking the row should open `https://www.example.com` in a new tab

---

## Test 8 — External URL form cancel

1. Open the card detail modal
2. Click "Attach a link"
3. Type a URL in the URL field
4. Click "Cancel"
5. Verify the form closes with no attachment added

---

## Test 9 — Image thumbnail grid

1. Open a card modal that already has one or more READY `image/*` attachments
2. Verify the thumbnail grid section (`data-testid="attachment-thumbnail-grid"`) is visible below the list
3. Verify each image thumbnail is rendered as a clickable `<button>`
4. Click a thumbnail
5. Verify the full-size image opens in a new browser tab

---

## Test 10 — Disallowed MIME type error toast

1. Open the card detail modal
2. Attach a file with a disallowed MIME type (e.g. `.exe` executable)
3. Verify a toast notification appears with the message "File type not allowed"
4. Verify no attachment row is added to the list

---

## Test 11 — File too large error toast

1. Open the card detail modal
2. Attach a file larger than 100 MB
3. Verify a toast notification appears with the message "File is too large (max 100 MB)"
4. Verify no attachment row is added to the list

---

## Test 12 — Multiple file upload concurrency

1. Open the card detail modal
2. Select 5 files simultaneously via the file picker
3. Verify all 5 upload rows appear in the attachment list
4. Verify at most 3 are uploading concurrently (only 3 progress bars visible at once)
5. All 5 should eventually reach "Ready" status

---

## Test 13 — Empty state

1. Open the card detail modal for a card with no attachments
2. Verify the empty-state message is shown: "No attachments yet. Drop a file or click 'Attach file'."
3. Verify neither the attachment list nor the thumbnail grid is rendered
