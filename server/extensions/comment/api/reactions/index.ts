// Reactions sub-router — mounts under /:commentId/reactions.
import { handleAddReaction } from './add';
import { handleRemoveReaction } from './remove';

export async function reactionsRouter(
  req: Request,
  commentId: string,
  remainingPath: string,
): Promise<Response | null> {
  // POST /api/v1/comments/:commentId/reactions
  if (req.method === 'POST' && remainingPath === '') {
    return handleAddReaction(req, commentId);
  }

  // DELETE /api/v1/comments/:commentId/reactions/:emoji
  if (req.method === 'DELETE' && remainingPath !== '') {
    const emoji = decodeURIComponent(remainingPath.replace(/^\//, ''));
    return handleRemoveReaction(req, commentId, emoji);
  }

  return null;
}
