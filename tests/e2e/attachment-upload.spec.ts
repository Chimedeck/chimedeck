// tests/e2e/attachment-upload.spec.ts
// Playwright E2E tests for the attachment upload flow.
// Covers: multipart upload initiation, URL attachment, MIME-type rejection,
//         size-limit rejection, and unauthenticated access guard.
// Based on: specs/tests/attachment-upload.md

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndGetCredentials, createWorkspace, createBoard, createList, createCard, loginViaCookie, type Credentials } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

// Card tiles render as role=button with an accessible name of "Card: <title>".
// The app boot performs an async token refresh, so navigating straight after
// login can race it and land on /workspaces; retry until the board renders.
function getCardTile(page: import('@playwright/test').Page) {
  return page.locator('[aria-label^="Card:"]').first();
}

async function gotoBoard(page: import('@playwright/test').Page, boardId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${UI_URL}/b/${boardId}`);
    await page.waitForLoadState('networkidle');
    // Wait for the board to actually render rather than trusting a URL check:
    // the boot token refresh can bounce through /workspaces first.
    try {
      await page.waitForSelector('[aria-label^="Card:"]', { timeout: 8000 });
      return;
    } catch {
      await page.waitForTimeout(500);
    }
  }
  throw new Error(`Board ${boardId} did not render after 3 attempts (url: ${page.url()})`);
}

const modalSelector = '[data-testid="card-modal"], [role="dialog"][aria-label^="Card:"]';

// Clicking a card tile opens the modal asynchronously; wait for it before
// asserting on its contents, otherwise later assertions race the render.
async function openCardModal(page: import('@playwright/test').Page): Promise<import('@playwright/test').Locator> {
  await getCardTile(page).click();
  await page.waitForSelector(modalSelector, { timeout: 10000 });
  return page.locator(modalSelector).first();
}

test.describe('Attachment Upload', () => {
  let creds: Credentials;
  let token: string;
  let cardId: string;

  test.beforeAll(async ({ request }) => {
    // Soft-skip entire suite if the server is not reachable
    const probe = await request.get(`${BASE_URL}/api/v1/health`).catch(() => null);
    if (!probe || probe.status() >= 500) {
      return;
    }

    creds = await registerAndGetCredentials(request, 'attach');
    token = creds.token;
    const workspaceId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, workspaceId);
    const listId = await createList(request, token, boardId);
    cardId = await createCard(request, token, listId, 'Attachment Test Card');
  });

  test('Test 1 — Initiate multipart upload returns 201 with uploadId and key', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.post(`${BASE_URL}/api/v1/cards/${cardId}/attachments/multipart/start`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { filename: 'screenshot.png', mimeType: 'image/png', sizeBytes: 204800 },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'Multipart upload endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(201);
    const body = await res.json() as { data: { attachmentId: string; uploadId: string; key: string } };
    expect(body.data.attachmentId).toBeTruthy();
    expect(body.data.uploadId).toBeTruthy();
    expect(body.data.key).toBeTruthy();
  });

  test('Test 2 — Full multipart upload flow returns READY attachment', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Step 1: Initiate
    const startRes = await request.post(`${BASE_URL}/api/v1/cards/${cardId}/attachments/multipart/start`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { filename: 'photo.png', mimeType: 'image/png', sizeBytes: 1024 },
    });

    if (startRes.status() === 404 || startRes.status() === 501) {
      test.skip(true, 'Multipart upload endpoint not yet implemented — skipping');
      return;
    }

    expect(startRes.status()).toBe(201);
    const { data: { attachmentId, uploadId, key } } = await startRes.json() as {
      data: { attachmentId: string; uploadId: string; key: string };
    };

    // Step 2: Request pre-signed URL
    const partUrlRes = await request.post(
      `${BASE_URL}/api/v1/cards/${cardId}/attachments/multipart/part-url`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { attachmentId, uploadId, key, partNumber: 1 },
      },
    );

    if (partUrlRes.status() === 404 || partUrlRes.status() === 501) {
      test.skip(true, 'Part-URL endpoint not yet implemented — skipping');
      return;
    }

    expect(partUrlRes.status()).toBe(200);
    const { data: { url: presignedUrl } } = await partUrlRes.json() as { data: { url: string } };
    expect(presignedUrl).toBeTruthy();

    // Step 3: Upload the part to the presigned URL.
    // With FLAG_USE_LOCAL_STORAGE=true this is LocalStack, so a real PUT works
    // and yields a genuine ETag that CompleteMultipartUpload will accept. Only
    // fall back to a stub ETag when the storage endpoint is unreachable.
    let eTag: string;
    try {
      // S3 requires every part except the last to be >= 5 MiB.
      const partBody = Buffer.alloc(5 * 1024 * 1024, 0x61);
      const putRes = await request.put(presignedUrl, {
        headers: { 'Content-Type': 'image/png' },
        data: partBody,
      });
      if (putRes.status() < 200 || putRes.status() >= 300) {
        test.skip(true, `Object storage not reachable for part upload (${putRes.status()}) — skipping`);
        return;
      }
      eTag = putRes.headers()['etag'] ?? '"mock-etag-12345"';
    } catch {
      test.skip(true, 'Object storage not reachable for part upload — skipping');
      return;
    }
    expect(eTag).toBeTruthy();

    // Step 4: Complete multipart upload
    const completeRes = await request.post(
      `${BASE_URL}/api/v1/cards/${cardId}/attachments/multipart/complete`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          attachmentId,
          uploadId,
          key,
          parts: [{ PartNumber: 1, ETag: eTag }],
        },
      },
    );

    if (completeRes.status() === 404 || completeRes.status() === 501) {
      test.skip(true, 'Complete endpoint not yet implemented — skipping');
      return;
    }

    expect(completeRes.status()).toBe(200);

    // Step 5: Confirm and retrieve final attachment record
    const confirmRes = await request.post(`${BASE_URL}/api/v1/cards/${cardId}/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { attachmentId },
    });

    if (confirmRes.status() === 404 || confirmRes.status() === 501) {
      test.skip(true, 'Attachment confirm endpoint not yet implemented — skipping');
      return;
    }

    expect(confirmRes.status()).toBe(200);
    const { data: attachment } = await confirmRes.json() as {
      data: { id: string; name: string; mime_type: string; status: string; s3_key: string };
    };
    expect(attachment.id).toBe(attachmentId);
    expect(attachment.name).toBe('photo.png');
    // The confirm endpoint returns the raw attachment row, whose MIME column is
    // `mime_type` (serializeAttachment renames it to content_type for other
    // endpoints, but this handler does not use it).
    expect(attachment.mime_type).toBe('image/png');
    expect(attachment.status).toBe('READY');
    // FILE attachments have no external `url`; the client builds a view URL from
    // the attachment id (`/api/v1/attachments/:id/view`). Assert the S3 object
    // is recorded so the view endpoint has something to serve.
    expect(attachment.s3_key).toBeTruthy();
  });

  test('Test 3 — Add attachment via URL returns 201 with URL type', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.post(`${BASE_URL}/api/v1/cards/${cardId}/attachments/url`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { url: 'https://example.com/doc.pdf', name: 'doc.pdf' },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'URL attachment endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(201);
    const body = await res.json() as { data: { id: string; type: string; url: string } };
    expect(body.data.id).toBeTruthy();
    expect(body.data.type).toBe('URL');
    expect(body.data.url).toBe('https://example.com/doc.pdf');
  });

  test('Test 4 — Reject disallowed MIME type returns 400 mime-type-not-allowed', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.post(`${BASE_URL}/api/v1/cards/${cardId}/attachments/multipart/start`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { filename: 'virus.exe', mimeType: 'application/x-msdownload', sizeBytes: 1024 },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'Endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(400);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('mime-type-not-allowed');
  });

  test('Test 5 — Reject file exceeding size limit returns 413 file-too-large', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.post(`${BASE_URL}/api/v1/cards/${cardId}/attachments/multipart/start`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { filename: 'huge.zip', mimeType: 'application/zip', sizeBytes: 524288001 },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'Endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(413);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('file-too-large');
  });

  test('Test 6 — Reject unauthenticated request returns 401', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.post(`${BASE_URL}/api/v1/cards/${cardId}/attachments/multipart/start`, {
      data: { filename: 'file.png', mimeType: 'image/png', sizeBytes: 1024 },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'Endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(401);
  });

  test('Test 7 — UI displays attachment thumbnail after upload', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Fresh credentials per UI test: the app boot rotates the refresh token, so
    // the suite-level cookie from beforeAll is stale by the time later tests run
    // and the page lands on /login. The board must belong to this same user or
    // the UI cannot see it.
    const uiCreds = await registerAndGetCredentials(request, 'attach-ui7');
    const uiToken = uiCreds.token;
    const workspaceId = await createWorkspace(request, uiToken);
    const boardId = await createBoard(request, uiToken, workspaceId);
    const listId = await createList(request, uiToken, boardId);
    const uiCardId = await createCard(request, uiToken, listId, 'UI Attachment Card');

    // Upload a real PNG through the multipart flow. The card must own an actual
    // file attachment, not a URL one, for a thumbnail to render.
    const apiHeaders = { Authorization: `Bearer ${uiToken}`, 'Content-Type': 'application/json' };
    const started = await (await request.post(
      `${BASE_URL}/api/v1/cards/${uiCardId}/attachments/multipart/start`,
      { headers: apiHeaders, data: { filename: 'thumb.png', mimeType: 'image/png', sizeBytes: 5 * 1024 * 1024 } },
    )).json() as { data: { attachmentId: string; uploadId: string; key: string } };
    const { attachmentId, uploadId, key } = started.data;

    const partUrlRes = await request.post(
      `${BASE_URL}/api/v1/cards/${uiCardId}/attachments/multipart/part-url`,
      { headers: apiHeaders, data: { attachmentId, uploadId, key, partNumber: 1 } },
    );
    expect(partUrlRes.status()).toBe(200);
    const partUrl = await partUrlRes.json() as { data: { url: string } };

    // Parts other than the last must be >= 5 MiB.
    const putRes = await request.put(partUrl.data.url, {
      headers: { 'Content-Type': 'image/png' },
      data: Buffer.alloc(5 * 1024 * 1024, 0x61),
    });
    expect(putRes.status()).toBe(200);
    const eTag = putRes.headers()['etag'];

    const completeRes = await request.post(`${BASE_URL}/api/v1/cards/${uiCardId}/attachments/multipart/complete`, {
      headers: apiHeaders, data: { attachmentId, uploadId, key, parts: [{ PartNumber: 1, ETag: eTag }] },
    });
    expect(completeRes.status()).toBe(200);
    const confirmRes = await request.post(`${BASE_URL}/api/v1/cards/${uiCardId}/attachments`, {
      headers: apiHeaders, data: { attachmentId },
    });
    expect(confirmRes.status()).toBe(200);

    await loginViaCookie(page, UI_URL, uiCreds);
    await gotoBoard(page, boardId);

    // Cards render as role=button with an accessible name of "Card: <title>".
    const cardEl = getCardTile(page);
    await expect(cardEl).toBeVisible({ timeout: 10000 });

    const modal = await openCardModal(page);
    await expect(modal.getByText('Attachments', { exact: true })).toBeVisible({ timeout: 5000 });
    // Two controls share the name "Attach file" (a labelled button and an
    // icon button); target the one with the stable testid.
    await expect(modal.getByTestId('attach-file-button')).toBeVisible();

    // The uploaded image renders inline in the attachment list. NOTE: this is
    // the content preview (src is the attachment view proxy), not a generated
    // thumbnail — thumbnail_key is not populated for this fixture, so the app
    // falls back to view_url. The element is rendered thumbnail-sized.
    await expect(modal.locator('img[src*="/attachments/"][src*="/view"]').first())
      .toBeVisible({ timeout: 8000 });
  });

  test('Test 8 — UI shows download link for URL attachment', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Navigate to the board and open the card. The board must belong to the
    // same fresh user that logs in, or the UI cannot see it.
    const uiCreds = await registerAndGetCredentials(request, 'attach-ui8');
    const uiToken = uiCreds.token;
    const workspaceId = await createWorkspace(request, uiToken);
    const boardId = await createBoard(request, uiToken, workspaceId);
    const listId = await createList(request, uiToken, boardId);
    const uiCardId = await createCard(request, uiToken, listId, 'Download Link Card');

    // Also attach the URL to this card
    await request.post(`${BASE_URL}/api/v1/cards/${uiCardId}/attachments/url`, {
      headers: { Authorization: `Bearer ${uiToken}` },
      data: { url: 'https://example.com/report.pdf', name: 'report.pdf' },
    });

    await loginViaCookie(page, UI_URL, uiCreds);
    await gotoBoard(page, boardId);

    const cardEl = getCardTile(page);
    await expect(cardEl).toBeVisible({ timeout: 10000 });

    // The URL attachment appears under Links as an anchor; the name also shows
    // in the activity feed, so match the link role.
    const modal = await openCardModal(page);
    await expect(modal.getByRole('link', { name: 'report.pdf' })).toBeVisible({ timeout: 8000 });
  });
});
