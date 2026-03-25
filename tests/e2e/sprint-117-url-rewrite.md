# Sprint 117 — S3 URL Rewrite in Card Description and Comment Renderers

## Prerequisites

- User is logged in
- At least one board and one card exist
- The card has an attachment of type FILE with:
  - `view_url` set to `/api/v1/attachments/<attachment_id>/view`
  - `url` (legacy) set to a raw S3 presigned URL like `https://test-bucket.s3.us-east-1.amazonaws.com/uploads/cards/123/image.png?X-Amz-...`
  - `content_type` = `image/png`
- The card description contains legacy Markdown with an embedded raw S3 presigned URL:
  `![screenshot](https://test-bucket.s3.us-east-1.amazonaws.com/uploads/cards/123/image.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600)`
- At least one comment on the card contains a raw S3 image URL in its body:
  `![photo](https://test-bucket.s3.us-east-1.amazonaws.com/uploads/cards/123/photo.jpg?X-Amz-...)`

---

## Test 1 — Card description with legacy S3 image src renders with proxy path in DOM

### Steps

1. Navigate to the board page.
2. Click on the card to open the card modal.
3. Inspect the rendered card description section.
4. Look for any `<img>` elements in the description area.

### Expected Results

- The description section is visible.
- Any `<img>` tag rendered from the legacy S3 markdown has its `src` attribute set to a proxy path (`/api/v1/attachments/<id>/view` or `/api/v1/attachments/<id>/thumbnail`).
- No `<img>` `src` attribute contains `amazonaws.com` in the card description area.

---

## Test 2 — Comment with legacy S3 image src renders with proxy path in DOM

### Steps

1. Navigate to the board page.
2. Click on the card to open the card modal.
3. Scroll down to the activity feed / comments section.
4. Locate the comment that contains the legacy S3 image URL.
5. Inspect the rendered `<img>` element inside that comment.

### Expected Results

- The comment is visible and renders an image.
- The `<img>` tag's `src` attribute is the proxy path (`/api/v1/attachments/<id>/view` or `/api/v1/attachments/<id>/thumbnail`).
- The `src` does NOT contain `amazonaws.com`.

---

## Test 3 — Inserting attachment image into description stores proxy path

### Steps

1. Navigate to the board page.
2. Click on the card to open the card modal.
3. Click on the description area to enter edit mode.
4. Click the attachment/image toolbar button (paperclip or image icon).
5. In the asset picker, select an existing FILE attachment that is an image.
6. Save the description.
7. Reload the page.
8. Open the card modal again and inspect the description.

### Expected Results

- After inserting, the editor shows the image inline.
- After saving and reloading, the description's `<img>` src is the proxy path (`/api/v1/attachments/<id>/view` or `/api/v1/attachments/<id>/thumbnail`).
- The saved description markdown does NOT contain any `amazonaws.com` URL.
- The image is visible (not broken) when the card is reopened.

---

## Test 4 — Inserting attachment image into comment stores proxy path

### Steps

1. Navigate to the board page.
2. Click on the card to open the card modal.
3. Click in the comment editor input area.
4. Click the attachment/image toolbar button in the comment editor.
5. In the asset picker, select an existing FILE attachment that is an image.
6. Click "Save" or press Ctrl+Enter to submit the comment.
7. Inspect the newly created comment in the activity feed.

### Expected Results

- The submitted comment renders an `<img>` element.
- The `<img>` src is the proxy path (`/api/v1/attachments/<id>/view` or `/api/v1/attachments/<id>/thumbnail`).
- The `src` does NOT contain `amazonaws.com`.
- The image is visible (not broken) in the comment.

---

## Test 5 — Non-S3 images in description are not affected

### Steps

1. Navigate to a card whose description contains a non-S3 image URL
   (e.g. `![img](https://example.com/photo.png)`).
2. Open the card modal and inspect the description.

### Expected Results

- The non-S3 `<img>` src is left unchanged.
- The image is still visible in the description.

---

## Test 6 — Attachment Comment action inserts proxy URL markdown

### Steps

1. Navigate to the board page and open a card modal.
2. Expand the Attachments panel.
3. Hover over a FILE attachment row to reveal action buttons.
4. Click the **Comment** action button on the attachment.
5. Inspect the comment editor textarea.

### Expected Results

- The comment editor receives a markdown snippet like `[filename](/api/v1/attachments/<id>/view)` or `[alias](/api/v1/attachments/<id>/view)`.
- The inserted text does NOT contain `amazonaws.com`.
- The comment editor textarea is focused and contains the inserted markdown.
