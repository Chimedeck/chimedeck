// tests/integration/attachments/mimeValidation.test.ts
// Integration tests for MIME-type allowlist and file-size validation on the
// POST /api/v1/cards/:id/attachments/upload-url endpoint.
//
// Strategy: handler-level tests that exercise validation logic directly.
// No real DB or S3 connection is needed — the handler returns early when
// MIME type or size is rejected, before touching those dependencies.
import { describe, it, expect } from 'bun:test';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../../../server/extensions/attachment/config/allowedTypes';
import { handleRequestUploadUrl } from '../../../server/extensions/attachment/api/requestUploadUrl';
import { issueAccessToken } from '../../../server/extensions/auth/mods/token/issue';

async function makeToken(): Promise<string> {
  return issueAccessToken({ sub: 'user-test', email: 'test@example.com' });
}

function makeUploadUrlRequest(
  cardId: string,
  body: object,
  token: string,
): Request {
  return new Request(`http://localhost/api/v1/cards/${cardId}/attachments/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// MIME-type allowlist
// ---------------------------------------------------------------------------

describe('ALLOWED_MIME_TYPES', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(ALLOWED_MIME_TYPES)).toBe(true);
    expect(ALLOWED_MIME_TYPES.length).toBeGreaterThan(0);
  });

  it('includes common image types', () => {
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_MIME_TYPES).toContain('image/webp');
  });

  it('includes application/pdf', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
  });

  it('does not include executable types', () => {
    expect(ALLOWED_MIME_TYPES).not.toContain('application/x-msdownload');
    expect(ALLOWED_MIME_TYPES).not.toContain('application/x-sh');
    expect(ALLOWED_MIME_TYPES).not.toContain('text/x-script.python');
  });
});

describe('MAX_FILE_SIZE_BYTES', () => {
  it('equals 100 MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// handleRequestUploadUrl — validation errors (no real DB/S3 required)
// These tests verify that rejected requests are returned before any DB lookup.
// ---------------------------------------------------------------------------

describe('POST /api/v1/cards/:id/attachments/upload-url — MIME validation', () => {
  it('returns 400 with name=mime-type-not-allowed for a disallowed MIME type', async () => {
    const token = await makeToken();
    const req = makeUploadUrlRequest('card-123', {
      filename: 'malware.exe',
      mimeType: 'application/x-msdownload',
      sizeBytes: 1024,
    }, token);

    const res = await handleRequestUploadUrl(req, 'card-123');
    expect(res.status).toBe(400);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('mime-type-not-allowed');
  });

  it('returns 400 with name=mime-type-not-allowed for application/octet-stream', async () => {
    const token = await makeToken();
    const req = makeUploadUrlRequest('card-123', {
      filename: 'binary.bin',
      mimeType: 'application/octet-stream',
      sizeBytes: 512,
    }, token);

    const res = await handleRequestUploadUrl(req, 'card-123');
    expect(res.status).toBe(400);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('mime-type-not-allowed');
  });

  it('returns 413 with name=file-too-large when sizeBytes exceeds 100 MB', async () => {
    const token = await makeToken();
    const oversizedBytes = MAX_FILE_SIZE_BYTES + 1;
    const req = makeUploadUrlRequest('card-123', {
      filename: 'huge-video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: oversizedBytes,
    }, token);

    const res = await handleRequestUploadUrl(req, 'card-123');
    expect(res.status).toBe(413);
    const body = await res.json() as { name: string; data: { sizeBytes: number; maxBytes: number } };
    expect(body.name).toBe('file-too-large');
    expect(body.data.maxBytes).toBe(MAX_FILE_SIZE_BYTES);
  });

  it('returns 413 for a file exactly 1 byte over the limit', async () => {
    const token = await makeToken();
    const req = makeUploadUrlRequest('card-456', {
      filename: 'over-limit.pdf',
      mimeType: 'application/pdf',
      sizeBytes: MAX_FILE_SIZE_BYTES + 1,
    }, token);

    const res = await handleRequestUploadUrl(req, 'card-456');
    expect(res.status).toBe(413);
  });

  it('does not immediately reject an allowed MIME type at the limit boundary', async () => {
    // A request with exactly MAX_FILE_SIZE_BYTES and an allowed type should pass
    // validation and proceed to DB lookup (which will fail with 404 for non-existent card).
    const token = await makeToken();
    const req = makeUploadUrlRequest('non-existent-card', {
      filename: 'boundary.pdf',
      mimeType: 'application/pdf',
      sizeBytes: MAX_FILE_SIZE_BYTES,
    }, token);

    const res = await handleRequestUploadUrl(req, 'non-existent-card');
    // Should not be 400 (mime) or 413 (size); will be 404 (card not found) or 401
    expect(res.status).not.toBe(400);
    expect(res.status).not.toBe(413);
  });

  it('does not reject image/jpeg (allowed type)', async () => {
    const token = await makeToken();
    const req = makeUploadUrlRequest('non-existent-card', {
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 48200,
    }, token);

    const res = await handleRequestUploadUrl(req, 'non-existent-card');
    expect(res.status).not.toBe(400);
    expect(res.status).not.toBe(413);
  });
});
