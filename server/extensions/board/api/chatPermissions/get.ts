// GET /api/v1/boards/:boardId/chat-permissions
// Sprint 165 — returns the board's chat permission settings.
// All board members (OWNER/ADMIN/MEMBER/VIEWER) can read; guests can read their own access level.
// Returns safe defaults when no row exists yet.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { CHAT_PERMISSION_DEFAULTS } from '../../mods/chatPermissions';

export async function handleGetChatPermissions(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const row = await db('board_chat_permissions').where({ board_id: boardId }).first();

  const permissions = row
    ? {
        board_id: boardId,
        guest_can_view: row.guest_can_view as boolean,
        guest_can_use: row.guest_can_use as boolean,
        updated_at: row.updated_at as string,
      }
    : {
        board_id: boardId,
        ...CHAT_PERMISSION_DEFAULTS,
        updated_at: new Date().toISOString(),
      };

  return Response.json({ data: permissions });
}
