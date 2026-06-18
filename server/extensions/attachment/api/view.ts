// GET /api/v1/attachments/:id/view
// Secure proxy endpoint: authenticates the caller, verifies board membership,
// then streams the object from S3 through the server to the browser.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { proxyS3Object } from '../common/proxyS3Object';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inferMimeType({
  mimeType,
  filename,
}: {
  mimeType?: string | null;
  filename?: string | null;
}): string {
  if (mimeType?.trim()) return mimeType;
  const name = (filename ?? '').toLowerCase();

  const byExtension: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.csv': 'text/csv',
  };

  const matchedExt = Object.keys(byExtension).find((extension) => name.endsWith(extension));
  if (matchedExt) return byExtension[matchedExt] as string;

  return 'application/octet-stream';
}

function isInlineSupportedMime(mimeType: string): boolean {
  if (mimeType.startsWith('image/')) return true;
  if (mimeType.startsWith('video/')) return true;
  if (mimeType === 'application/pdf') return true;
  if (mimeType.startsWith('text/')) return true;
  return (
    mimeType === 'application/json' || mimeType === 'application/xml' || mimeType === 'text/xml'
  );
}

function renderViewerPage({
  filename,
  mimeType,
  rawUrl,
  downloadUrl,
}: {
  filename: string;
  mimeType: string;
  rawUrl: string;
  downloadUrl: string;
}): string {
  const safeName = escapeHtml(filename);
  const safeMime = escapeHtml(mimeType);
  const supportedInline = isInlineSupportedMime(mimeType);

  let content = '';
  if (mimeType.startsWith('image/')) {
    content = `<img src="${rawUrl}" alt="${safeName}" style="max-width:100%;max-height:78vh;object-fit:contain;border-radius:8px;" />`;
  } else if (mimeType.startsWith('video/')) {
    content = `<video controls playsinline style="width:min(1100px,100%);max-height:78vh;border-radius:8px;background:#000;" src="${rawUrl}"></video>`;
  } else if (supportedInline) {
    content = `<iframe src="${rawUrl}" title="${safeName}" style="width:100%;height:78vh;border:1px solid #d4d4d8;border-radius:8px;background:#fff;"></iframe>`;
  } else {
    content = `
      <div style="max-width:740px;border:1px solid #d4d4d8;border-radius:10px;padding:20px;background:#fff;">
        <h2 style="margin:0 0 8px 0;font-size:20px;">Preview not available</h2>
        <p style="margin:0 0 8px 0;color:#52525b;">This file type is not supported for inline preview.</p>
        <p style="margin:0 0 16px 0;color:#27272a;"><strong>File:</strong> ${safeName}</p>
        <a href="${downloadUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">Download file</a>
      </div>
    `;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeName}</title>
  </head>
  <body style="margin:0;background:#f4f4f5;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <main style="padding:16px;">
      <header style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;">
        <div>
          <h1 style="margin:0;font-size:20px;line-height:1.3;word-break:break-word;">${safeName}</h1>
          <p style="margin:4px 0 0 0;color:#52525b;font-size:13px;">${safeMime}</p>
        </div>
        <a href="${downloadUrl}" style="padding:10px 14px;border-radius:8px;background:#18181b;color:#fff;text-decoration:none;font-weight:600;">Download</a>
      </header>
      ${content}
    </main>
  </body>
</html>`;
}

function shouldRenderHtmlViewer(req: Request, rawMode: boolean, downloadMode: boolean): boolean {
  if (rawMode || downloadMode) return false;
  const secFetchDest = (req.headers.get('sec-fetch-dest') ?? '').toLowerCase();
  if (secFetchDest === 'document' || secFetchDest === 'iframe') return true;
  const accept = (req.headers.get('accept') ?? '').toLowerCase();
  return accept.includes('text/html');
}

export async function handleViewAttachment(req: Request, attachmentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const attachment = await db('attachments').where({ id: attachmentId }).first();
  if (!attachment) {
    return Response.json(
      { name: 'attachment-not-found', data: { message: 'Attachment not found' } },
      { status: 404 }
    );
  }

  const card = await db('cards').where({ id: attachment.card_id }).first();
  const list = card ? await db('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 }
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  // URL-type attachments: redirect directly to the external URL
  if (attachment.type === 'URL') {
    const target = attachment.url ?? attachment.external_url;
    if (!target) {
      return Response.json(
        { name: 'attachment-url-missing', data: { message: 'No URL on attachment' } },
        { status: 404 }
      );
    }
    return Response.redirect(target, 302);
  }

  if (attachment.status === 'PENDING') {
    return Response.json(
      { name: 'attachment-pending', data: { message: 'Attachment is still being processed' } },
      { status: 202 }
    );
  }

  if (attachment.status === 'REJECTED') {
    return Response.json(
      { name: 'attachment-rejected', data: { message: 'Attachment was rejected by virus scan' } },
      { status: 422 }
    );
  }

  if (!attachment.s3_key) {
    return Response.json(
      { name: 'attachment-key-missing', data: { message: 'No S3 key on attachment' } },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const rawMode = url.searchParams.get('raw') === '1';
  const downloadMode = url.searchParams.get('download') === '1';
  const filename = (attachment.alias ?? attachment.name ?? 'attachment').trim() || 'attachment';
  const mimeType = inferMimeType({ mimeType: attachment.mime_type, filename });

  if (shouldRenderHtmlViewer(req, rawMode, downloadMode)) {
    const basePath = `/api/v1/attachments/${attachment.id}/view`;
    const html = renderViewerPage({
      filename,
      mimeType,
      rawUrl: `${basePath}?raw=1`,
      downloadUrl: `${basePath}?download=1`,
    });
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return proxyS3Object({
    s3Key: attachment.s3_key,
    fallbackContentType: mimeType,
    fallbackFilename: filename,
    contentDisposition: downloadMode ? 'attachment' : 'inline',
  });
}
