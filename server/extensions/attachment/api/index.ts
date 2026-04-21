// Attachment API router — registers all attachment-related routes.
import { handleRequestUploadUrl } from './requestUploadUrl';
import { handleConfirmUpload } from './confirmUpload';
import { handleAddUrl } from './addUrl';
import { handleDeleteAttachment } from './delete';
import { handleListAttachments } from './list';
import { handleViewAttachment } from './view';
import { handleThumbnailAttachment } from './thumbnail';
import { handlePatchAttachment } from './patch';
import { handleLinkPreview } from './linkPreview';
import { handleMultipartStart } from './multipart/start';
import { handleMultipartPartUrl } from './multipart/partUrl';
import { handleMultipartComplete } from './multipart/complete';
import { handleMultipartAbort } from './multipart/abort';
import { resolveAttachmentId } from '../../../common/ids/resolveEntityId';

export async function attachmentRouter(req: Request, pathname: string): Promise<Response | null> {
  // POST /api/v1/cards/:id/attachments/multipart/start
  const multipartStartMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/attachments\/multipart\/start$/);
  if (multipartStartMatch && req.method === 'POST') {
    return handleMultipartStart(req, multipartStartMatch[1] as string);
  }

  // POST /api/v1/cards/:id/attachments/multipart/part-url
  const multipartPartUrlMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/attachments\/multipart\/part-url$/);
  if (multipartPartUrlMatch && req.method === 'POST') {
    return handleMultipartPartUrl(req, multipartPartUrlMatch[1] as string);
  }

  // POST /api/v1/cards/:id/attachments/multipart/complete
  const multipartCompleteMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/attachments\/multipart\/complete$/);
  if (multipartCompleteMatch && req.method === 'POST') {
    return handleMultipartComplete(req, multipartCompleteMatch[1] as string);
  }

  // DELETE /api/v1/cards/:id/attachments/multipart/:uploadId
  const multipartAbortMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/attachments\/multipart\/([^/]+)$/);
  if (multipartAbortMatch && req.method === 'DELETE') {
    return handleMultipartAbort(req, multipartAbortMatch[1] as string, multipartAbortMatch[2] as string);
  }

  // POST /api/v1/cards/:id/attachments/upload-url
  const uploadUrlMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/attachments\/upload-url$/);
  if (uploadUrlMatch && req.method === 'POST') {
    return handleRequestUploadUrl(req, uploadUrlMatch[1] as string);
  }

  // POST /api/v1/cards/:id/attachments/url
  const addUrlMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/attachments\/url$/);
  if (addUrlMatch && req.method === 'POST') {
    return handleAddUrl(req, addUrlMatch[1] as string);
  }

  // GET /api/v1/cards/:id/attachments — list all attachments with signed URLs
  const listMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/attachments$/);
  if (listMatch && req.method === 'GET') {
    return handleListAttachments(req, listMatch[1] as string);
  }

  // POST /api/v1/cards/:id/attachments  (confirm upload — must come after specific paths above)
  const confirmMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/attachments$/);
  if (confirmMatch && req.method === 'POST') {
    return handleConfirmUpload(req, confirmMatch[1] as string);
  }

  // GET /api/v1/attachments/:id/view — secure file proxy (auth required)
  const viewMatch = pathname.match(/^\/api\/v1\/attachments\/([^/]+)\/view$/);
  if (viewMatch && req.method === 'GET') {
    const attachmentId = await resolveAttachmentId(viewMatch[1] as string);
    if (!attachmentId) {
      return Response.json({ name: 'attachment-not-found', data: { message: 'Attachment not found' } }, { status: 404 });
    }
    return handleViewAttachment(req, attachmentId);
  }

  // GET /api/v1/attachments/:id/thumbnail — secure thumbnail proxy (auth required)
  const thumbnailMatch = pathname.match(/^\/api\/v1\/attachments\/([^/]+)\/thumbnail$/);
  if (thumbnailMatch && req.method === 'GET') {
    const attachmentId = await resolveAttachmentId(thumbnailMatch[1] as string);
    if (!attachmentId) {
      return Response.json({ name: 'attachment-not-found', data: { message: 'Attachment not found' } }, { status: 404 });
    }
    return handleThumbnailAttachment(req, attachmentId);
  }

  // PATCH /api/v1/attachments/:id — update alias
  const patchMatch = pathname.match(/^\/api\/v1\/attachments\/([^/]+)$/);
  if (patchMatch && req.method === 'PATCH') {
    const attachmentId = await resolveAttachmentId(patchMatch[1] as string);
    if (!attachmentId) {
      return Response.json({ name: 'attachment-not-found', data: { message: 'Attachment not found' } }, { status: 404 });
    }
    return handlePatchAttachment(req, attachmentId);
  }

  // DELETE /api/v1/attachments/:id
  const deleteRe = /^\/api\/v1\/attachments\/([^/]+)$/;
  const deleteMatch = deleteRe.exec(pathname);
  if (deleteMatch && req.method === 'DELETE') {
    const attachmentId = await resolveAttachmentId(deleteMatch[1] as string);
    if (!attachmentId) {
      return Response.json({ name: 'attachment-not-found', data: { message: 'Attachment not found' } }, { status: 404 });
    }
    return handleDeleteAttachment(req, attachmentId);
  }

  // GET /api/v1/link-preview?url=...
  if (pathname === '/api/v1/link-preview' && req.method === 'GET') {
    return handleLinkPreview(req);
  }

  return null;
}
