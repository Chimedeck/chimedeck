# Sprint 59 — Card Attachment Upload (Enhanced Backend)

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 12 (Attachments baseline), Sprint 11 (Comments & Activity)
> **References:** [technical-decisions.md §8 – File Upload](../architecture/technical-decisions.md)

---

## Goal

Extend the Sprint 12 attachment backend with multipart upload support for large files, image thumbnail generation, MIME-type allowlist validation, and an orphan-cleanup worker — so the card modal can reliably handle everything from tiny screenshots to multi-gigabyte videos.

---

## Scope

### 1. DB Migration `0033_attachments_enhanced.ts` (new)

```ts
// Extend the existing `attachments` table
table.string('thumbnail_key').nullable();        // S3 key for generated thumbnail (images only)
table.string('content_type', 128).nullable();    // validated MIME type returned from S3 HEAD
table.integer('width').nullable();               // image dimensions (if applicable)
table.integer('height').nullable();
table.timestamp('scan_completed_at').nullable(); // timestamp when virus scan finished
table.string('scan_vendor', 64).nullable();      // e.g. "clamav", "mock"
```

---

### 2. MIME-Type Allowlist

Centralise in `server/extensions/attachments/config/allowedTypes.ts`:

```ts
export const ALLOWED_MIME_TYPES: string[] = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Text
  'text/plain', 'text/csv', 'text/markdown',
  // Archives
  'application/zip', 'application/x-tar', 'application/gzip',
  // Video (stored but no preview)
  'video/mp4', 'video/webm',
  // Audio
  'audio/mpeg', 'audio/ogg', 'audio/wav',
];

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
```

Validation occurs on the `POST /api/v1/cards/:id/attachments/upload-url` endpoint before issuing a pre-signed URL.

---

### 3. Multipart Upload (Large Files)

For files > 5 MB use S3 multipart upload instead of a single pre-signed PUT.

New endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/cards/:id/attachments/multipart/start` | Initiate multipart upload → `{ uploadId, key }` |
| `POST` | `/api/v1/cards/:id/attachments/multipart/part-url` | Pre-signed URL for one part → `{ partUrl, partNumber }` |
| `POST` | `/api/v1/cards/:id/attachments/multipart/complete` | Complete multipart upload → `{ data: Attachment }` |
| `DELETE` | `/api/v1/cards/:id/attachments/multipart/:uploadId` | Abort multipart upload |

Flow:
```
1. Client checks file.size > 5 MB
2. POST /multipart/start → { uploadId, key }
3. Split file into 5 MB chunks
4. For each chunk: POST /multipart/part-url → PUT to S3
5. Collect ETags from each PUT response
6. POST /multipart/complete { uploadId, key, parts: [{partNumber, eTag}] }
   → Server calls S3 CompleteMultipartUpload
   → Enqueues virus scan + thumbnail job
   → Returns confirmed Attachment row
```

File in: `server/extensions/attachments/api/multipart/`

---

### 4. Thumbnail Generation Worker

`server/extensions/attachments/workers/thumbnail.ts`

- Runs after virus scan passes (status transitions `PENDING → READY`)
- Uses **sharp** (Bun-native compatible) to resize images to 400×300 max, preserve aspect ratio
- Stores thumbnail at `thumbnails/<card_id>/<attachment_id>.webp` in S3
- Updates `thumbnail_key` column

Triggered via an in-process job queue (existing event pipeline) — no new infra needed.

---

### 5. Orphan Cleanup Worker

`server/extensions/attachments/workers/orphanCleanup.ts`

- Runs on a schedule (every 30 minutes via Bun's `setInterval`)
- Finds `Attachment` rows with `status = PENDING` older than 1 hour and no confirmed upload
- Deletes the S3 object and the database row
- Logs each deletion as a structured event

---

### 6. API Changes

#### `GET /api/v1/cards/:id/attachments`

Updated response shape:

```json
{
  "data": [
    {
      "id": "...",
      "name": "screenshot.png",
      "type": "FILE",
      "mimeType": "image/png",
      "sizeBytes": 48200,
      "status": "READY",
      "url": "https://...",        // pre-signed GET URL (TTL 1 hour)
      "thumbnailUrl": "https://...",  // only if thumbnail_key present
      "width": 1920,
      "height": 1080,
      "createdAt": "..."
    }
  ]
}
```

Pre-signed GET URLs are generated on-the-fly in the response handler (not stored in DB).

---

### 7. Server Files

```
server/extensions/attachments/
  api/
    index.ts                       # router: existing + new multipart routes
    uploadUrl.ts                   # single-file pre-signed PUT (updated: MIME check)
    confirm.ts                     # confirm upload, enqueue scan + thumbnail
    multipart/
      start.ts
      partUrl.ts
      complete.ts
      abort.ts
    list.ts                        # GET attachments (updated: add thumbnailUrl)
    delete.ts                      # DELETE attachment
  config/
    allowedTypes.ts
    s3.ts                          # S3 client (Bun.env, no process.env)
  workers/
    thumbnail.ts
    orphanCleanup.ts
  common/
    presign.ts                     # shared pre-signed URL helper
```

---

## Acceptance Criteria

- [ ] Files ≤ 5 MB use single pre-signed PUT; files > 5 MB use multipart upload
- [ ] Uploading a disallowed MIME type returns `{ name: 'mime-type-not-allowed' }` (400)
- [ ] Attempting to exceed 100 MB returns `{ name: 'file-too-large' }` (413)
- [ ] Image attachments have a `thumbnailUrl` populated after status → READY
- [ ] Abandoning a multipart upload leaves no orphan rows after 1 hour
- [ ] All S3 credentials sourced from `server/extensions/attachments/config/s3.ts` (not `process.env` directly)

---

## Tests

- `tests/integration/attachments/upload.test.ts` — single-file and multipart flows (LocalStack S3)
- `tests/integration/attachments/thumbnails.test.ts` — thumbnail generation on READY transition
- `tests/integration/attachments/orphanCleanup.test.ts` — stale pending rows are purged
