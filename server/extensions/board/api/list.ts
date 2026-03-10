// GET /api/v1/workspaces/:workspaceId/boards — list all boards (active + archived); min role: VIEWER.
// Each board includes `isStarred` (boolean) for the current user.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleListBoards(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'VIEWER');
  if (roleError) return roleError;

  const boards = await db('boards as b')
    .leftJoin('board_stars as bs', function () {
      this.on('bs.board_id', '=', 'b.id').andOn('bs.user_id', '=', db.raw('?', [userId]));
    })
    .where({ 'b.workspace_id': workspaceId })
    .select('b.*', db.raw('(bs.board_id IS NOT NULL) as "isStarred"'))
    .orderBy('b.created_at', 'asc');

  return Response.json({ data: boards });
}
