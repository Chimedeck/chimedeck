// Attachment API router — registers all attachment-related routes.
import { handleRequestUploadUrl } from './requestUploadUrl';
import { handleConfirmUpload } from './confirmUpload';
import { handleAddUrl } from './addUrl';
import { handleDeleteAttachment } from './delete';
import { handleGetSignedUrl } from './getSignedUrl';
import { handleListAttachments } from './list';
import { handleMultipartStart } from './multipart/start';
import { handleMultipartPartUrl } from './multipart/partUrl';
import { handleMultipartComplete } from './multipart/complete';
import { handleMultipartAbort } from './multipart/abort';

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

  // GET /api/v1/attachments/:id/url
  const signedUrlMatch = pathname.match(/^\/api\/v1\/attachments\/([^/]+)\/url$/);
  if (signedUrlMatch && req.method === 'GET') {
    return handleGetSignedUrl(req, signedUrlMatch[1] as string);
  }

  // DELETE /api/v1/attachments/:id
  const deleteMatch = pathname.match(/^\/api\/v1\/attachments\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    return handleDeleteAttachment(req, deleteMatch[1] as string);
  }

  return null;
}
