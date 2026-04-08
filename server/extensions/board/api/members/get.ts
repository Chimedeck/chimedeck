// GET /api/v1/boards/:id/members — list explicit board members from the board_members table.
// Board ADMIN+ or workspace OWNER/ADMIN can list members.
// Workspace MEMBER/VIEWER who are board members can also list.
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import type { BoardVisibilityScopedRequest } from '../../../../middlewares/boardVisibility';
import {
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { buildAvatarProxyUrlsInCollection } from '../../../../common/avatar/resolveAvatarUrl';

export async function handleGetBoardMembers(req: Request, boardId: string): Promise<Response> {
  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;

  // OWNER/ADMIN can always list; others need at least VIEWER workspace role.
  // (applyBoardVisibility already enforces general access — just need a role check here.)
  if (board.visibility !== 'PUBLIC') {
    const roleError = requireRole(scopedReq as WorkspaceScopedRequest, 'VIEWER');
    if (roleError) return roleError;
  }

  const members = await db('board_members as bm')
    .join('users as u', 'bm.user_id', 'u.id')
    // [why] Exclude workspace GUESTs — they belong in the Guests tab, not Members.
    .join('memberships as ms', function () {
      this.on('ms.user_id', '=', 'bm.user_id').andOn(
        'ms.workspace_id',
        '=',
        db.raw('?', [board.workspace_id]),
      );
    })
    .whereNot('ms.role', 'GUEST')
    .where('bm.board_id', boardId)
    .select(
      db.raw('u.id as user_id'),
      db.raw('bm.board_id as board_id'),
      'u.email',
      db.raw("COALESCE(u.name, u.email) as display_name"),
      'u.avatar_url',
      'u.nickname',
      'bm.role',
      'bm.created_at',
    )
    .orderBy('bm.created_at', 'asc');

  const data = buildAvatarProxyUrlsInCollection(
    members as Array<{ avatar_url?: string | null } & Record<string, unknown>>,
  );

  return Response.json({ data });
}
