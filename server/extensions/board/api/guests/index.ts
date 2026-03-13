// Barrel export for board guest handlers.
// POST /api/v1/boards/:id/guests   — invite a user as a guest (ADMIN+ only) via email.
// DELETE /api/v1/boards/:id/guests/:userId — revoke guest access.
// GET  /api/v1/boards/:id/guests   — list current board guests.
export { handleInviteGuestByEmail as handleInviteGuest } from './create';

import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { writeEvent } from '../../../../mods/events/index';

// Legacy userId-based handler kept for internal use.
async function handleInviteGuestById(req: Request, boardId: string): Promise<Response> {
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

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: 'invalid-request-body', message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  const { userId } = body;
  if (!userId) {
    return Response.json(
      { error: { code: 'missing-user-id', message: 'userId is required' } },
      { status: 400 },
    );
  }

  const targetUser = await db('users').where({ id: userId }).first();
  if (!targetUser) {
    return Response.json(
      { error: { code: 'user-not-found', message: 'User not found' } },
      { status: 404 },
    );
  }

  // Prevent inviting existing workspace members (OWNER, ADMIN, MEMBER, VIEWER) as guests.
  const existingMembership = await db('memberships')
    .where({ user_id: userId, workspace_id: board.workspace_id })
    .first();

  if (existingMembership && existingMembership.role !== 'GUEST') {
    return Response.json(
      { error: { code: 'user-already-workspace-member', message: 'User is already a workspace member with a higher role' } },
      { status: 409 },
    );
  }

  await db.transaction(async (trx) => {
    // Upsert a GUEST membership so the user is recognised as a workspace participant.
    if (!existingMembership) {
      await trx('memberships').insert({
        user_id: userId,
        workspace_id: board.workspace_id,
        role: 'GUEST',
      });
    }

    // Grant board-scoped access — idempotent.
    await trx('board_guest_access')
      .insert({
        id: randomUUID(),
        user_id: userId,
        board_id: boardId,
        granted_by: (req as AuthenticatedRequest).currentUser!.id,
      })
      .onConflict(['user_id', 'board_id'])
      .ignore();
  });

  const grantRow = await db('board_guest_access')
    .where({ user_id: userId, board_id: boardId })
    .first();

  // Emit real-time event so board subscribers learn about the new guest member (§8).
  writeEvent({
    type: 'member_joined',
    boardId,
    entityId: boardId,
    actorId: (req as AuthenticatedRequest).currentUser!.id,
    payload: {
      scope: 'board',
      userId: targetUser.id,
      displayName: (targetUser.name as string | undefined) ?? targetUser.email,
      role: 'GUEST',
      joinedAt: new Date().toISOString(),
    },
  }).catch(() => {});

  return Response.json({ data: grantRow }, { status: 201 });
}

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

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  const grantRow = await db('board_guest_access').where({ user_id: userId, board_id: boardId }).first();
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

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'VIEWER');
  if (roleError) return roleError;

  const guests = await db('board_guest_access')
    .join('users', 'board_guest_access.user_id', 'users.id')
    .where('board_guest_access.board_id', boardId)
    .select(
      db.raw('users.id as id'),
      'users.email',
      db.raw('COALESCE(users.name, users.email) as name'),
      'board_guest_access.granted_at',
      'board_guest_access.granted_by',
    );

  return Response.json({ data: guests });
}
