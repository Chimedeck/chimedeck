// Barrel export for board guest handlers.
// POST /api/v1/boards/:id/guests   — invite a user as a guest (ADMIN+ only) via email.
// DELETE /api/v1/boards/:id/guests/:userId — revoke guest access.
// GET  /api/v1/boards/:id/guests   — list current board guests.
// PATCH /api/v1/boards/:id/guests/:userId — update guest type (ADMIN+ only).
export { handleInviteGuestByEmail as handleInviteGuest } from './create';
export { handleUpdateGuestType } from './updateGuest';

import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
type ResolvedBoardRequest = BoardScopedRequest & { board: { workspace_id: string } };
type GuestGrantRow = { id: string };


// DELETE /api/v1/boards/:id/guests/:userId
// Requires ADMIN+ role. Revokes board-scoped guest access.
// Also removes the GUEST workspace membership if the user has no other board grants.
export async function handleRevokeGuest(
  req: Request,
  boardId: string,
  userId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as ResolvedBoardRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  const grantRow = (await db('board_guest_access')
    .where({ user_id: userId, board_id: boardId })
    .first()) as GuestGrantRow | undefined;
  if (!grantRow) {
    return Response.json(
      { error: { code: 'guest-access-not-found', message: 'Guest access record not found' } },
      { status: 404 },
    );
  }

  await db.transaction(async (trx) => {
    await trx('board_guest_access').where({ user_id: userId, board_id: boardId }).delete();

    // Remove GUEST workspace membership only if no other board grants remain.
    const remainingGrants = await trx('board_guest_access')
      .join('boards', 'board_guest_access.board_id', 'boards.id')
      .where({
        'board_guest_access.user_id': userId,
        'boards.workspace_id': board.workspace_id,
      })
      .count('board_guest_access.id as count')
      .first();

    const count = Number((remainingGrants as { count: string | number } | undefined)?.count ?? 0);
    if (count === 0) {
      await trx('memberships')
        .where({ user_id: userId, workspace_id: board.workspace_id, role: 'GUEST' })
        .delete();
    }
  });

  return Response.json({ data: { board_id: boardId, user_id: userId, revoked: true } });
}

// GET /api/v1/boards/:id/guests
// Requires VIEWER+ workspace role (ADMIN required above but reading is open to all members).
export async function handleListGuests(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as ResolvedBoardRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const guests = await db('board_guest_access')
    .join('users', 'board_guest_access.user_id', 'users.id')
    .where('board_guest_access.board_id', boardId)
    .select(
      db.raw('users.id as id'),
      'users.email',
      db.raw('COALESCE(users.name, users.email) as name'),
      'board_guest_access.guest_type as guestType',
      'board_guest_access.granted_at as grantedAt',
      'board_guest_access.granted_by as grantedBy',
    );

  return Response.json({ data: guests });
}
