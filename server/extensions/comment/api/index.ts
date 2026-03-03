// Comment API router.
import { handleCreateComment } from './create';
import { handleListComments } from './list';
import { handleUpdateComment } from './update';
import { handleDeleteComment } from './delete';

export async function commentRouter(req: Request, pathname: string): Promise<Response | null> {
  // GET|POST /api/v1/cards/:id/comments
  const cardCommentsMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/comments$/);
  if (cardCommentsMatch) {
    if (req.method === 'GET') return handleListComments(req, cardCommentsMatch[1] as string);
    if (req.method === 'POST') return handleCreateComment(req, cardCommentsMatch[1] as string);
  }

  // PATCH /api/v1/comments/:id
  const commentMatch = pathname.match(/^\/api\/v1\/comments\/([^/]+)$/);
  if (commentMatch) {
    if (req.method === 'PATCH') return handleUpdateComment(req, commentMatch[1] as string);
    if (req.method === 'DELETE') return handleDeleteComment(req, commentMatch[1] as string);
  }

  return null;
}
