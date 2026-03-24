# Sprint 90 · Iteration 3 — Attachment(s) Extension i18n

## Purpose
Verify that both the `Attachment` and `Attachments` extensions read all their
UI copy from their respective `translations/en.json` files and that no
hard-coded English strings remain in any component. All visible text (section
title, upload hint, button labels, status badges, confirmation dialogs,
placeholders, and aria-labels) must match the JSON values exactly.

## Preconditions
- Dev server is running and reachable.
- At least one board with at least one card exists in the workspace.
- The signed-in user has write permission on the card.

---

## Test 1 — Attachments section header renders correctly

### Steps
1. Log in and navigate to a board.
2. Open any card modal that includes the Attachments panel (`AttachmentPanel`).
3. Locate the Attachments section header.

### Expected
- The heading reads **"Attachments"**
  (from `translations['attachments.panel.title']`).
- An **"Attach file"** button is visible beside the heading
  (from `translations['attachments.panel.attachFile']`).
- No raw translation key (e.g. `attachments.panel.title`) is visible.

---

## Test 2 — Empty state message

### Steps
1. Open a card that has **no attachments**.
2. Observe the Attachments section body.

### Expected
- The text **"No attachments yet. Drop a file or click \"Attach file\"."**
  is displayed (from `translations['attachments.panel.empty']`).

---

## Test 3 — Drag-and-drop overlay hint

### Steps
1. Open a card modal.
2. Drag a file over the card modal area (do not drop yet).

### Expected
- A full-panel overlay appears with the text **"Drop files to attach"**
  (from `translations['attachments.dropZone.hint']`).

---

## Test 4 — File upload progress and status badges

### Steps
1. Click **"Attach file"** and select a file to upload.
2. Observe the in-progress upload row while the upload is in flight.
3. Wait for the upload to complete and verify the status chip changes.

### Expected
- While uploading, the status chip reads **"Uploading"**
  (from `translations['attachments.item.status.uploading']`).
- After server scanning, the status chip may read **"Scanning"**
  (from `translations['attachments.item.status.scanning']`).
- When complete, the chip reads **"Ready"**
  (from `translations['attachments.item.status.ready']`).
- If rejected, the chip reads **"Rejected"**
  (from `translations['attachments.item.status.rejected']`).

---

## Test 5 — Delete confirmation dialog

### Steps
1. Open a card with at least one attachment.
2. Click the trash/delete icon next to an attachment.

### Expected
- An inline confirmation appears with the text **"Delete?"**
  (from `translations['attachments.item.delete.confirm']`).
- Two buttons appear: **"Yes"** and **"No"**
  (from `translations['attachments.item.delete.yes']` and
  `translations['attachments.item.delete.no']`).
- Clicking **"No"** dismisses the confirmation without deleting.
- Clicking **"Yes"** removes the attachment from the list.

---

## Test 6 — Attach a link form

### Steps
1. Open a card modal with write permission.
2. Click **"Attach a link"** below the attachment list.

### Expected
- The button label reads **"Attach a link"**
  (from `translations['attachments.panel.link.attachLink']`).
- A URL input with placeholder **"https://…"** appears
  (from `translations['attachments.panel.link.urlPlaceholder']`).
- A name input with placeholder **"Display name (optional)"** appears
  (from `translations['attachments.panel.link.namePlaceholder']`).
- A submit button labelled **"Attach"** and a cancel button labelled
  **"Cancel"** are visible
  (from `translations['attachments.panel.link.attach']` and
  `translations['attachments.panel.link.cancel']`).
- Submitting a valid URL adds it to the attachment list.
- Clicking **"Cancel"** hides the form without submitting.

---

## Test 7 — Image and video thumbnail sections

### Steps
1. Upload an image file (e.g. `.png`) and a video file (e.g. `.mp4`) to a card.
2. After both uploads complete (status = Ready), observe the thumbnail grid.

### Expected
- An **"Images"** section header appears above the image thumbnails
  (from `translations['attachments.panel.imagesSection']`).
- A **"Videos"** section header appears above the video thumbnails
  (from `translations['attachments.panel.videosSection']`).
- Each image thumbnail button has an accessible label
  **"Preview &lt;filename&gt;"**
  (from `translations['attachments.thumbnail.image.preview.ariaLabel']`
  with `{name}` replaced).
- Each video thumbnail button has an accessible label
  **"Play &lt;filename&gt;"**
  (from `translations['attachments.thumbnail.video.play.ariaLabel']`
  with `{name}` replaced).

---

## Test 8 — Lightbox close buttons

### Steps
1. Click an image thumbnail to open the image lightbox.
2. Observe the close button.
3. Close and click a video thumbnail to open the video lightbox.
4. Observe the close button.

### Expected
- Image lightbox close button has aria-label **"Close image preview"**
  (from `translations['attachments.thumbnail.image.close.ariaLabel']`).
- Video lightbox close button has aria-label **"Close video player"**
  (from `translations['attachments.thumbnail.video.close.ariaLabel']`).
- Clicking either close button dismisses the lightbox.

---

## Test 9 — No regressions

### Steps
1. Complete Tests 1–8 in sequence on the same card.

### Expected
- All Attachments panel behaviours work identically to pre-i18n behaviour.
- No JavaScript errors appear in the browser console.
- No visible text is a raw translation key (e.g. `attachments.panel.title`).
