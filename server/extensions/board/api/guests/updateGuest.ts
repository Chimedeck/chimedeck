// handleUpdateGuestType — PATCH /api/v1/boards/:boardId/guests/:userId
// Allows ADMIN+ to change a guest's sub-type between VIEWER and MEMBER.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { writeEvent } from '../../../../mods/events/index';
import type { GuestType } from '../../types';

export async function handleUpdateGuestType(
  req: Request,
  boardId: string,
  targetUserId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: { guestType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  const { guestType } = body;
  if (!guestType) {
    return Response.json(
      { name: 'missing-guest-type', data: { message: 'guestType is required' } },
      { status: 400 },
    );
  }
  if (guestType !== 'VIEWER' && guestType !== 'MEMBER') {
    return Response.json(
      { name: 'invalid-guest-type', data: { message: 'guestType must be VIEWER or MEMBER' } },
      { status: 400 },
    );
  }

  const validGuestType = guestType as GuestType;

  const existing = await db('board_guest_access')
    .where({ user_id: targetUserId, board_id: boardId })
    .first();

  if (!existing) {
    return Response.json(
      { name: 'guest-access-not-found', data: { message: 'Guest access record not found' } },
      { status: 404 },
    );
  }

  await db('board_guest_access')
    .where({ user_id: targetUserId, board_id: boardId })
    .update({ guest_type: validGuestType });

  const updated = await db('board_guest_access')
    .join('users', 'board_guest_access.user_id', 'users.id')
    .where({ 'board_guest_access.user_id': targetUserId, 'board_guest_access.board_id': boardId })
    .select(
      db.raw('users.id as id'),
      'users.email',
      db.raw('COALESCE(users.name, users.email) as name'),
      'board_guest_access.guest_type as guestType',
      'board_guest_access.granted_at as grantedAt',
      'board_guest_access.granted_by as grantedBy',
    )
    .first();

  writeEvent({
    type: 'member_updated',
    boardId,
    entityId: boardId,
    actorId: (req as AuthenticatedRequest).currentUser!.id,
    payload: {
      scope: 'board',
      userId: targetUserId,
      role: 'GUEST',
      guestType: validGuestType,
      updatedAt: new Date().toISOString(),
    },
  }).catch(() => {});

  return Response.json({ data: updated });
}
