// Attachment API router — registers all attachment-related routes.
import { handleRequestUploadUrl } from './requestUploadUrl';
import { handleConfirmUpload } from './confirmUpload';
import { handleAddUrl } from './addUrl';
import { handleDeleteAttachment } from './delete';
import { handleGetSignedUrl } from './getSignedUrl';

export async function attachmentRouter(req: Request, pathname: string): Promise<Response | null> {
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
