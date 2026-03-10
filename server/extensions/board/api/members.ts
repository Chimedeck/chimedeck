// GET /api/v1/boards/:id/members — list workspace members accessible to board.
// PUBLIC boards: no auth required. WORKSPACE/PRIVATE: min role VIEWER.
import { db } from '../../../common/db';
import {
  requireRole,
} from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';

export async function handleGetBoardMembers(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;

  if (board.visibility !== 'PUBLIC') {
    const roleError = requireRole(scopedReq, 'VIEWER');
    if (roleError) return roleError;
  }

  const members = await db('memberships')
    .join('users', 'memberships.user_id', 'users.id')
    .where('memberships.workspace_id', board.workspace_id)
    .select(
      db.raw('users.id as id'),
      'users.email',
      db.raw('COALESCE(users.name, users.email) as name'),
      'memberships.role',
    );

  return Response.json({ data: members });
}
