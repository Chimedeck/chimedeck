// tests/integration/attachments/multipart.test.ts
// Integration tests for the multipart upload endpoints.
//
// Strategy: handler-level tests that exercise route logic directly.
// S3 calls are covered for validation paths; full S3 flow requires LocalStack
// (run with docker-compose.yml — the test suite skips S3 calls in CI by default).
import { describe, it, expect } from 'bun:test';
import { handleMultipartStart } from '../../../server/extensions/attachment/api/multipart/start';
import { handleMultipartPartUrl } from '../../../server/extensions/attachment/api/multipart/partUrl';
import { handleMultipartComplete } from '../../../server/extensions/attachment/api/multipart/complete';
import { handleMultipartAbort } from '../../../server/extensions/attachment/api/multipart/abort';
import { issueAccessToken } from '../../../server/extensions/auth/mods/token/issue';

async function makeToken(): Promise<string> {
  return issueAccessToken({ sub: 'user-test', email: 'test@example.com' });
}

function makeJsonRequest(url: string, method: string, body: object, token: string): Request {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// POST /multipart/start — input validation (no DB / S3 required)
// ---------------------------------------------------------------------------

describe('POST /api/v1/cards/:id/attachments/multipart/start — validation', () => {
  it('returns 400 when body is missing required fields', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/start',
      'POST',
      { filename: 'video.mp4' }, // missing mimeType and sizeBytes
      token,
    );
    const res = await handleMultipartStart(req, 'card-1');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('bad-request');
  });

  it('returns 400 with name=mime-type-not-allowed for disallowed MIME', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/start',
      'POST',
      { filename: 'malware.exe', mimeType: 'application/x-msdownload', sizeBytes: 10 * 1024 * 1024 },
      token,
    );
    const res = await handleMultipartStart(req, 'card-1');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('mime-type-not-allowed');
  });

  it('returns 413 with name=file-too-large for oversized file', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/start',
      'POST',
      { filename: 'huge.mp4', mimeType: 'video/mp4', sizeBytes: 200 * 1024 * 1024 },
      token,
    );
    const res = await handleMultipartStart(req, 'card-1');
    expect(res.status).toBe(413);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('file-too-large');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const token = await makeToken();
    const req = new Request('http://localhost/api/v1/cards/card-1/attachments/multipart/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await handleMultipartStart(req, 'card-1');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /multipart/part-url — input validation
// ---------------------------------------------------------------------------

describe('POST /api/v1/cards/:id/attachments/multipart/part-url — validation', () => {
  it('returns 400 when uploadId is missing', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/part-url',
      'POST',
      { key: 'attachments/card-1/att-1/file.mp4', partNumber: 1 }, // missing uploadId
      token,
    );
    const res = await handleMultipartPartUrl(req, 'card-1');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('bad-request');
  });

  it('returns 400 when key is missing', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/part-url',
      'POST',
      { uploadId: 'upload-1', partNumber: 1 }, // missing key
      token,
    );
    const res = await handleMultipartPartUrl(req, 'card-1');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('bad-request');
  });

  it('returns 422 for partNumber=0 (out of range)', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/part-url',
      'POST',
      { uploadId: 'upload-1', key: 'attachments/card-1/att-1/file.mp4', partNumber: 0 },
      token,
    );
    const res = await handleMultipartPartUrl(req, 'card-1');
    expect(res.status).toBe(422);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('invalid-part-number');
  });

  it('returns 422 for partNumber=10001 (out of range)', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/part-url',
      'POST',
      { uploadId: 'upload-1', key: 'attachments/card-1/att-1/file.mp4', partNumber: 10001 },
      token,
    );
    const res = await handleMultipartPartUrl(req, 'card-1');
    expect(res.status).toBe(422);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('invalid-part-number');
  });
});

// ---------------------------------------------------------------------------
// POST /multipart/complete — input validation
// ---------------------------------------------------------------------------

describe('POST /api/v1/cards/:id/attachments/multipart/complete — validation', () => {
  it('returns 400 when parts array is missing', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/complete',
      'POST',
      { uploadId: 'upload-1', key: 'attachments/card-1/att-1/file.mp4' }, // missing parts
      token,
    );
    const res = await handleMultipartComplete(req, 'card-1');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('bad-request');
  });

  it('returns 400 when parts array is empty', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/complete',
      'POST',
      { uploadId: 'upload-1', key: 'attachments/card-1/att-1/file.mp4', parts: [] },
      token,
    );
    const res = await handleMultipartComplete(req, 'card-1');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('bad-request');
  });

  it('returns 400 when uploadId is missing', async () => {
    const token = await makeToken();
    const req = makeJsonRequest(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/complete',
      'POST',
      { key: 'attachments/card-1/att-1/file.mp4', parts: [{ partNumber: 1, eTag: 'abc' }] },
      token,
    );
    const res = await handleMultipartComplete(req, 'card-1');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('bad-request');
  });
});

// ---------------------------------------------------------------------------
// DELETE /multipart/:uploadId — input validation
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/cards/:id/attachments/multipart/:uploadId — validation', () => {
  it('returns 400 when key query param is missing', async () => {
    const token = await makeToken();
    const req = new Request(
      'http://localhost/api/v1/cards/card-1/attachments/multipart/upload-id-123',
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        // No ?key= query param
      },
    );
    const res = await handleMultipartAbort(req, 'card-1', 'upload-id-123');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { name: string };
    expect(json.name).toBe('bad-request');
  });
});
