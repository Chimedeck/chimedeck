// GET /api/v1/boards/:id/members — list workspace members accessible to board.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../middlewares/requireBoardAccess';

export async function handleGetBoardMembers(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'VIEWER');
  if (roleError) return roleError;

  const members = await db('memberships')
    .join('users', 'memberships.user_id', 'users.id')
    .where('memberships.workspace_id', board.workspace_id)
    .select('users.id', 'users.email', 'users.name', 'memberships.role');

  return Response.json({ data: members });
}
