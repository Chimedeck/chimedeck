// boardVisibility.ts — enforces board visibility access rules on GET routes.
// PUBLIC boards: accessible without authentication.
// WORKSPACE boards: require workspace membership.
// PRIVATE boards: require workspace membership (strictest mode).
import { db } from '../common/db';
import { authenticate, type AuthenticatedRequest } from '../extensions/auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from './permissionManager';
import type { BoardVisibility } from '../extensions/board/types';

export interface BoardVisibilityScopedRequest extends WorkspaceScopedRequest {
  board?: {
    id: string;
    workspace_id: string;
    title: string;
    state: string;
    visibility: BoardVisibility;
    description: string | null;
    background: string | null;
    monetization_type: string | null;
    created_at: string;
  };
}

// Enforces board visibility access control on any board-scoped route.
// On success, attaches `board` to the request and (for non-public boards)
// also populates `currentUser`, `workspaceId`, and `callerRole` via the
// standard auth/membership chain so downstream handlers can call requireRole().
// Returns null on success, or an error Response.
export async function applyBoardVisibility(
  req: Request,
  boardId: string,
): Promise<Response | null> {
  const board = await db('boards').where({ id: boardId }).first();

  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  (req as BoardVisibilityScopedRequest).board = board;

  // PUBLIC boards are read-accessible without a session token.
  if (board.visibility === 'PUBLIC') {
    return null;
  }

  // WORKSPACE and PRIVATE boards require an authenticated workspace member.
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const membershipError = await requireWorkspaceMembership(
    req as WorkspaceScopedRequest,
    board.workspace_id,
  );
  if (membershipError) return membershipError;

  return null;
}
