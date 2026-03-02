# Sprint 12 — Attachments

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §5.8](../architecture/requirements.md), [technical-decisions.md §§8, 9](../architecture/technical-decisions.md)

---

## Goal

Cards can have file attachments (uploaded directly to S3/R2) and external URL links. Uploads are transactional — a failure at any step does not corrupt card state — and files are scanned for viruses before becoming accessible.

---

## Scope

### 1. Data Model

```prisma
model Attachment {
  id        String           @id @default(cuid())
  cardId    String
  uploadedBy String
  name      String           // original filename or URL label
  type      AttachmentType

  // For FILE type
  s3Key     String?
  s3Bucket  String?
  mimeType  String?
  sizeBytes Int?
  status    AttachmentStatus @default(PENDING)  // FILE only

  // For URL type
  url       String?

  createdAt DateTime         @default(now())

  card      Card  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  uploader  User  @relation(fields: [uploadedBy], references: [id])
}

enum AttachmentType {
  FILE
  URL
}

enum AttachmentStatus {
  PENDING    // upload initiated, virus scan in progress
  READY      // scan passed
  REJECTED   // scan failed
}
```

Migration: `0011_attachments`

### 2. File Upload Flow (Pre-Signed S3 PUT)

Per [technical-decisions.md §8](../architecture/technical-decisions.md):

```
1. POST /api/v1/cards/:id/attachments/upload-url
   Body: { filename, mimeType, sizeBytes }
   → Server: create Attachment row (status=PENDING), generate S3 pre-signed PUT URL (TTL 5 min)
   → Response: { data: { attachmentId, uploadUrl, s3Key } }

2. Client: PUT <uploadUrl> with file binary (S3 directly, not via API server)

3. POST /api/v1/cards/:id/attachments
   Body: { attachmentId }  ← confirms the upload
   → Server: verify S3 object exists (HeadObject), enqueue virus scan job
   → Response: { data: Attachment } (status=PENDING)

4. Virus scan worker completes:
   → UPDATE Attachment status = READY | REJECTED
   → Publish WS event attachment_updated to board channel
```

If step 3 is never called (client abandons): orphan cleanup worker deletes S3 object + Attachment row after 1 hour.

### 3. External URL Flow

```
POST /api/v1/cards/:id/attachments/url
Body: { name, url }
→ Server validates URL is not an internal address (SSRF prevention)
→ Creates Attachment row (type=URL, status=READY)
→ Response: { data: Attachment }
```

### 4. Signed Read URL

Attachments are **not publicly accessible** from S3 (per [requirements §5.8](../architecture/requirements.md) — signed URL access).

```
GET /api/v1/attachments/:id/url
→ Verifies caller is VIEWER+ in the workspace
→ Generates S3 pre-signed GET URL (TTL 15 min)
→ Response: { data: { url, expiresAt } }
```

### 5. Server Extension

```
server/extensions/attachment/
  api/
    index.ts
    requestUploadUrl.ts   # POST /api/v1/cards/:id/attachments/upload-url
    confirmUpload.ts      # POST /api/v1/cards/:id/attachments
    addUrl.ts             # POST /api/v1/cards/:id/attachments/url
    delete.ts             # DELETE /api/v1/attachments/:id
    getSignedUrl.ts       # GET /api/v1/attachments/:id/url
  common/
    config/
      s3.ts               # S3 client using Bun.env.S3_*
  mods/
    s3/
      presignPut.ts
      presignGet.ts
      headObject.ts
      deleteObject.ts
    virusScan/
      enqueue.ts          # push scan job to Redis list
      worker.ts           # Bun worker: pop from Redis, call ClamAV/VirusTotal
      update.ts           # update Attachment status, publish WS event
    orphanCleanup.ts      # cron: delete stale PENDING attachments > 1 hour
```

### 6. API Routes

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| `POST` | `/api/v1/cards/:id/attachments/upload-url` | MEMBER | Request pre-signed PUT URL |
| `POST` | `/api/v1/cards/:id/attachments` | MEMBER | Confirm upload |
| `POST` | `/api/v1/cards/:id/attachments/url` | MEMBER | Add external URL |
| `GET` | `/api/v1/attachments/:id/url` | VIEWER | Get signed read URL |
| `DELETE` | `/api/v1/attachments/:id` | MEMBER (own) / ADMIN | Delete attachment |

### 7. SSRF Prevention

External URLs must not target private IP ranges. Validated by `url` module against:
- `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`

Blocked URL → error name `url-target-forbidden`

### 8. WS Events

- `attachment_updated` — published on virus scan completion (status change)
- `attachment_added` — published on `confirmUpload` and `addUrl`
- `attachment_deleted` — published on delete

### 9. Frontend Extension

```
src/extensions/Attachment/
  components/
    AttachmentSection.tsx      # list of attachments in card modal
    AttachmentItem.tsx         # file icon + name + status + download
    AttachmentUploader.tsx     # drag-and-drop file zone
    AttachmentUrlModal.tsx     # add external URL form
    AttachmentStatusBadge.tsx  # PENDING / READY / REJECTED badge
  hooks/
    useAttachmentUpload.ts     # manages three-step upload flow
```

Upload progress shown with `XMLHttpRequest` progress event (native, no library).

---

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `attachment-not-found` | 404 | Invalid attachment ID |
| `upload-url-expired` | 400 | S3 key missing on confirm (upload not completed) |
| `virus-scan-rejected` | 422 | Attachment scan failed |
| `url-target-forbidden` | 400 | URL resolves to private address |
| `attachment-not-owner` | 403 | Non-owner delete (non-ADMIN) |

---

## Tests

- Unit: SSRF URL validator, orphan cleanup TTL logic
- Integration: full upload flow (request URL → confirm → scan complete), external URL creation, delete cascades S3 object

---

## Acceptance Criteria

- [ ] File upload: S3 object exists after step 2; Attachment row exists after step 3
- [ ] Abandoned upload (step 3 never called): row + S3 object cleaned up after 1 hour
- [ ] Virus-rejected attachment is not downloadable (`status: REJECTED`)
- [ ] PENDING attachment: signed read URL returns 202 or `attachment-pending` error
- [ ] External URL pointing to `127.0.0.1` returns 400 `url-target-forbidden`
- [ ] Deleting attachment removes S3 object (for FILE type)
- [ ] WS `attachment_updated` delivered on scan completion
