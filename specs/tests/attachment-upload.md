> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Attachment Upload

## Overview
Verifies that a file can be attached to a card using the multipart upload flow: initiate upload, upload parts, complete, and confirm. Also validates access control and file-type restrictions.

## Pre-conditions
- User is authenticated (JWT or `hf_` API token)
- A workspace, board, list, and card exist
- The user is a member of the workspace

## Steps

### 1. Initiate multipart upload
1. `POST /api/v1/cards/:cardId/attachments/multipart/start` with header `Authorization: Bearer <token>` and body:
   ```json
   { "filename": "screenshot.png", "mimeType": "image/png", "sizeBytes": 204800 }
   ```
2. **Assert** response status is `201`
3. **Assert** response body has shape `{ "data": { "attachmentId": "<uuid>", "uploadId": "<string>", "key": "<string>" } }`
4. Capture `attachmentId`, `uploadId`, and `key` from the response

### 2. Request a pre-signed URL for a part
1. `POST /api/v1/cards/:cardId/attachments/multipart/part-url` with body:
   ```json
   { "attachmentId": "<attachmentId>", "uploadId": "<uploadId>", "key": "<key>", "partNumber": 1 }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has `{ "data": { "url": "<presignedUrl>" } }`
4. Capture `url`

### 3. Upload part directly to S3 (simulated)
1. `PUT <presignedUrl>` with the raw file bytes in the body and `Content-Type: image/png`
2. **Assert** response status is `200`
3. Capture the `ETag` response header

### 4. Complete multipart upload
1. `POST /api/v1/cards/:cardId/attachments/multipart/complete` with body:
   ```json
   { "attachmentId": "<attachmentId>", "uploadId": "<uploadId>", "key": "<key>", "parts": [{ "PartNumber": 1, "ETag": "<etag>" }] }
   ```
2. **Assert** response status is `200`

### 5. Confirm upload and get final attachment record
1. `POST /api/v1/cards/:cardId/attachments` with body:
   ```json
   { "attachmentId": "<attachmentId>" }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has shape:
   ```json
   { "data": { "id": "<attachmentId>", "name": "screenshot.png", "mimeType": "image/png", "status": "READY", "url": "<string>" } }
   ```

### 6. Add attachment via URL (alternative flow)
1. `POST /api/v1/cards/:cardId/attachments/url` with body:
   ```json
   { "url": "https://example.com/doc.pdf", "name": "doc.pdf" }
   ```
2. **Assert** response status is `201`
3. **Assert** response body has `{ "data": { "id": "<uuid>", "type": "URL", "url": "https://example.com/doc.pdf" } }`

### 7. Reject disallowed MIME type
1. `POST /api/v1/cards/:cardId/attachments/multipart/start` with body:
   ```json
   { "filename": "virus.exe", "mimeType": "application/x-msdownload", "sizeBytes": 1024 }
   ```
2. **Assert** response status is `400`
3. **Assert** response body has `{ "name": "mime-type-not-allowed" }`

### 8. Reject file exceeding size limit
1. `POST /api/v1/cards/:cardId/attachments/multipart/start` with body where `sizeBytes` exceeds the max (e.g. `524288001`):
   ```json
   { "filename": "huge.zip", "mimeType": "application/zip", "sizeBytes": 524288001 }
   ```
2. **Assert** response status is `413`
3. **Assert** response body has `{ "name": "file-too-large" }`

### 9. Reject unauthenticated request
1. `POST /api/v1/cards/:cardId/attachments/multipart/start` with no `Authorization` header
2. **Assert** response status is `401`

## Expected Result
- Multipart upload flow completes successfully and returns a `READY` attachment with a download URL
- URL attachments are saved immediately
- Disallowed MIME types return `400 mime-type-not-allowed`
- Oversized files return `413 file-too-large`
- Unauthenticated requests return `401`