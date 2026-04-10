// Replies sub-router — mounts under /:commentId/replies.
import { handleGetReplies } from './get';

export async function repliesRouter(
  req: Request,
  commentId: string,
): Promise<Response | null> {
  // GET /api/v1/comments/:commentId/replies
  if (req.method === 'GET') {
    return handleGetReplies(req, commentId);
  }

  return null;
}
