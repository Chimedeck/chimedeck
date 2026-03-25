# Sprint 117 — Attachment Comment Action (Playwright MCP)

## Scenario 1: Comment button appears on a READY attachment row

1. Navigate to the app and log in as a board member.
2. Open a card that has at least one READY file attachment (status chip shows "Ready").
3. Locate the attachment list inside the card modal under the "Attachments" section.
4. Assert that a button with `data-testid="attachment-comment-button"` is visible on the READY attachment row.
5. Assert that the button is NOT present on PENDING or REJECTED attachment rows.

## Scenario 2: Clicking Comment inserts a markdown link into the comment editor

1. Navigate to the app and log in as a board member.
2. Open a card that has at least one READY file attachment with a `view_url` proxy path.
3. Locate the comment editor textarea (the "Add a comment…" input in the Activity section).
4. Click the comment button (`data-testid="attachment-comment-button"`) on the READY attachment row.
5. Assert that the comment editor now contains a markdown link of the form `[name](/api/v1/attachments/:id/view)`.
6. Assert that the inserted text uses the proxy path — it must NOT contain `s3.amazonaws.com` or any raw S3 hostname.

## Scenario 3: Inserted markdown uses alias when set

1. Navigate to the app and log in as a board member.
2. Open a card that has a READY file attachment with an alias set (e.g. "My Report").
3. Click the comment button on that attachment row.
4. Assert that the comment editor contains `[My Report](/api/v1/attachments/:id/view)` — the alias, not the original filename.

## Scenario 4: Inserted markdown falls back to name when alias is null

1. Navigate to the app and log in as a board member.
2. Open a card that has a READY file attachment with no alias (alias is null).
3. Click the comment button on that attachment row.
4. Assert that the comment editor contains `[original-filename.ext](/api/v1/attachments/:id/view)`.

## Scenario 5: Comment button is absent for URL-type attachments without view_url

1. Navigate to the app and log in as a board member.
2. Open a card that has a URL-type attachment (external link, not a file upload).
3. Assert that the `data-testid="attachment-comment-button"` button is NOT present on that row (URL attachments do not have a `view_url` proxy path).

## Scenario 6: No network request is made when Comment button is clicked

1. Navigate to the app and log in as a board member.
2. Open the browser Network DevTools panel and start monitoring requests.
3. Open a card with a READY file attachment and click the Comment button.
4. Assert that no new network request is triggered (the insertion is purely client-side).
5. Assert that the markdown text is still present in the comment editor.
