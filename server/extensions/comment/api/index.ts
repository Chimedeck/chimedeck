// Comment API router.
import { handleCreateComment } from './create';
import { handleListComments } from './list';
import { handleUpdateComment } from './update';
import { handleDeleteComment } from './delete';
import { reactionsRouter } from './reactions/index';
import { repliesRouter } from './replies/index';

export async function commentRouter(req: Request, pathname: string): Promise<Response | null> {
  // GET|POST /api/v1/cards/:id/comments
  const cardCommentsMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/comments$/);
  if (cardCommentsMatch) {
    if (req.method === 'GET') return handleListComments(req, cardCommentsMatch[1] as string);
    if (req.method === 'POST') return handleCreateComment(req, cardCommentsMatch[1] as string);
  }

  // PATCH|DELETE /api/v1/comments/:id
  const commentMatch = pathname.match(/^\/api\/v1\/comments\/([^/]+)$/);
  if (commentMatch) {
    if (req.method === 'PATCH') return handleUpdateComment(req, commentMatch[1] as string);
    if (req.method === 'DELETE') return handleDeleteComment(req, commentMatch[1] as string);
  }

  // POST /api/v1/comments/:commentId/reactions
  // DELETE /api/v1/comments/:commentId/reactions/:emoji
  const reactionsMatch = pathname.match(/^\/api\/v1\/comments\/([^/]+)\/reactions(\/.*)?$/);
  if (reactionsMatch) {
    const commentId = reactionsMatch[1] as string;
    const remaining = reactionsMatch[2] ?? '';
    return reactionsRouter(req, commentId, remaining);
  }

  // GET /api/v1/comments/:commentId/replies
  const repliesMatch = pathname.match(/^\/api\/v1\/comments\/([^/]+)\/replies$/);
  if (repliesMatch) {
    return repliesRouter(req, repliesMatch[1] as string);
  }

  return null;
}
