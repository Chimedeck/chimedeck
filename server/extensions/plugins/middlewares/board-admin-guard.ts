// Middleware — verifies the authenticated user is a board admin (ADMIN or OWNER role
// in the board's workspace). Returns 403 with { name: 'not-board-admin' } if not.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import type { Role } from '../../../middlewares/permissionManager';

const ADMIN_ROLES: Role[] = ['OWNER', 'ADMIN'];

export interface BoardAdminRequest extends AuthenticatedRequest {
  boardId?: string;
}

// Returns null on success (caller is a board admin), or an error Response.
// Expects boardId to be extracted and passed in by the route handler.
export async function boardAdminGuard(
  req: BoardAdminRequest,
  boardId: string,
): Promise<Response | null> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const membership = await db('memberships')
    .where({ user_id: req.currentUser!.id, workspace_id: board.workspace_id })
    .first();

  if (!membership || !ADMIN_ROLES.includes(membership.role as Role)) {
    return Response.json(
      { error: { code: 'not-board-admin', message: 'Board admin access required' } },
      { status: 403 },
    );
  }

  req.boardId = boardId;
  return null;
}
