> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Board Background UI — Playwright Test Spec

## Overview
Tests for Sprint 76 board background image upload, rendering, removal, thumbnail display in the workspace dashboard, and real-time WebSocket update propagation.

## Prerequisites
- A workspace and board are already created.
- The current user is a board Owner or Admin.
- The server POST/DELETE `/api/v1/boards/:id/background` endpoints are running.
- A valid JPEG test image (`test-bg.jpg`) is available in the test fixtures directory.

---

## Test 1 — Background section is visible in Board Settings

```
Given the user is on a board page
When the user opens Board Settings (clicks the settings gear / menu)
Then the Board Settings panel slides in
And a "Background" section is visible
And it contains an "Upload image" button
And a "No background set" placeholder is shown (if no background is currently set)
```

**Steps:**
1. Navigate to `/boards/:boardId`.
2. Click the settings button (aria-label "Open settings" or similar).
3. Assert the panel with `aria-label="Board Settings"` is visible.
4. Assert the text "Background" is present in the panel.
5. Assert a button/label with text "Upload image" is present.
6. Assert the placeholder text "No background set" is visible when no background is set.

---

## Test 2 — Upload a valid JPEG background image

```
Given the Board Settings panel is open
When the user selects a valid JPEG file via the "Upload image" input
Then the file is uploaded (POST /api/v1/boards/:id/background)
And the preview image appears in the settings panel
And the board canvas (BoardPage) shows the uploaded image as background
And the list columns remain visible and legible over the background
```

**Steps:**
1. Open Board Settings as in Test 1.
2. Locate the hidden `<input type="file">` with id `bg-upload-input`.
3. Set its value to the path of `test-bg.jpg` (JPEG fixture).
4. Trigger the `change` event.
5. Assert the "Uploading…" label appears during the request.
6. After upload completes, assert a `<img>` preview is visible in the Background section.
7. Close Board Settings.
8. Assert the board background is rendered as a CSS `background-image` on the outer container.
9. Assert at least one list column is visible over the background (check for `w-72` or `aria-label` starting with "List:").

---

## Test 3 — Remove board background

```
Given the board has an existing background image
And the Board Settings panel is open
When the user clicks "Remove"
Then the background is deleted (DELETE /api/v1/boards/:id/background)
And the preview is replaced with the "No background set" placeholder
And the board canvas no longer shows a background-image
```

**Steps:**
1. Ensure a background is already uploaded (can run Test 2 first, or seed the DB).
2. Open Board Settings.
3. Assert the "Remove" button is visible.
4. Click "Remove".
5. Assert "Removing…" label appears during the request.
6. After removal, assert the "No background set" placeholder is visible.
7. Close Board Settings.
8. Assert the board outer container does NOT have an inline `background-image` style.

---

## Test 4 — Upload with invalid MIME type is rejected

```
Given the Board Settings panel is open
When the user selects a GIF or SVG file via the "Upload image" input
Then the server returns 400 with name "mime-type-not-allowed"
And an error message is displayed in the Background section
```

**Steps:**
1. Open Board Settings.
2. Select a `test-image.gif` or `test-image.svg` fixture via the file input.
3. Assert the error message appears (e.g. "mime-type-not-allowed").

---

## Test 5 — Board thumbnail appears in workspace dashboard grid

```
Given the board has a background image
When the user navigates to the workspace boards list (/workspaces/:id/boards)
Then the BoardCard for this board shows the background image as a thumbnail (h-20 area)
```

**Steps:**
1. Ensure the target board has a background image set.
2. Navigate to `/workspaces/:workspaceId/boards`.
3. Find the `BoardCard` for the target board.
4. Assert an `<img>` element with `src` matching the background URL is present inside the card.

---

## Test 6 — Board background thumbnail in search results

```
Given the board has a background image
When the user opens the command palette (Cmd+K or search icon)
And searches for the board title
Then the board result row shows the 32×20 px background thumbnail
```

**Steps:**
1. Ensure the target board has a background image set.
2. Open the search modal (trigger keyboard shortcut Cmd+K or click the search button).
3. Type the board title in the search input.
4. Wait for board results to appear.
5. Assert an `<img>` inside a `<span class="... w-8 h-5 ...">` is visible for the board result row.

---

## Test 7 — Real-time update: background change received by other connected clients

```
Given two browser contexts are open on the same board (User A and User B)
When User A uploads a background image via Board Settings
Then User B's board view updates in real-time to show the new background
Without a page reload
```

**Steps:**
1. Open two pages on the same board URL in separate browser contexts.
2. In context A, upload a background image as in Test 2.
3. In context B, assert the board outer container's `background-image` style updates within 3 seconds.
4. (No reload allowed between step 2 and 3.)

---

## Acceptance Criteria Summary

| # | Criterion |
|---|-----------|
| 1 | Background section visible in Board Settings |
| 2 | Valid JPEG/PNG uploads successfully; preview shown; background rendered behind columns |
| 3 | Remove button clears background from UI and DB |
| 4 | Invalid MIME type rejected with user-visible error |
| 5 | Board card in workspace grid shows background thumbnail |
| 6 | Search result row for a board shows 32×20 px background thumbnail |
| 7 | Other connected clients receive WS `board.background_changed` and update in real time |