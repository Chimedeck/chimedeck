// handleInviteGuestByEmail — resolve user by email (or create stub account),
// then grant board-scoped GUEST access.
// Accepts: { email: string }  — no userId needed from the caller.
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handleInviteGuestByEmail(req: Request, boardId: string): Promise<Response> {
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

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  const { email } = body;
  if (!email || !isValidEmail(email)) {
    return Response.json(
      { name: 'invalid-email', data: { message: 'A valid email address is required' } },
      { status: 400 },
    );
  }

  // Prevent inviting existing workspace members (non-GUEST) as guests.
  const existingMember = await db('memberships')
    .join('users', 'memberships.user_id', 'users.id')
    .where({ 'users.email': email, 'memberships.workspace_id': board.workspace_id })
    .whereNot('memberships.role', 'GUEST')
    .first();

  if (existingMember) {
    return Response.json(
      { name: 'user-already-workspace-member', data: { message: 'This user is already a workspace member' } },
      { status: 409 },
    );
  }

  // Resolve or create user.
  let user = await db('users').where({ email }).first();
  if (!user) {
    // [why] Stub account: minimal row so the invite can be stored.
    // The user can claim the account later via a future invite-acceptance flow.
    const userId = randomUUID();
    await db('users').insert({
      id: userId,
      email,
      name: email.split('@')[0] ?? email,
    });
    user = await db('users').where({ id: userId }).first();
  }

  const userId = user.id as string;

  // Check for duplicate board guest access.
  const existing = await db('board_guest_access')
    .where({ user_id: userId, board_id: boardId })
    .first();

  if (existing) {
    return Response.json(
      { name: 'already-invited', data: { message: 'This user is already a guest on this board' } },
      { status: 409 },
    );
  }

  // Get or create GUEST workspace membership.
  const existingMembership = await db('memberships')
    .where({ user_id: userId, workspace_id: board.workspace_id })
    .first();

  await db.transaction(async (trx) => {
    if (!existingMembership) {
      await trx('memberships').insert({
        user_id: userId,
        workspace_id: board.workspace_id,
        role: 'GUEST',
      });
    }

    await trx('board_guest_access').insert({
      id: randomUUID(),
      user_id: userId,
      board_id: boardId,
      granted_by: (req as AuthenticatedRequest).currentUser!.id,
    });
  });

  const grantRow = await db('board_guest_access')
    .join('users', 'board_guest_access.user_id', 'users.id')
    .where({ 'board_guest_access.user_id': userId, 'board_guest_access.board_id': boardId })
    .select(
      db.raw('users.id as id'),
      'users.email',
      db.raw('COALESCE(users.name, users.email) as name'),
      'board_guest_access.granted_at',
      'board_guest_access.granted_by',
    )
    .first();

  writeEvent({
    type: 'member_joined',
    boardId,
    entityId: boardId,
    actorId: (req as AuthenticatedRequest).currentUser!.id,
    payload: {
      scope: 'board',
      userId,
      displayName: (user.name as string | undefined) ?? email,
      role: 'GUEST',
      joinedAt: new Date().toISOString(),
    },
  }).catch(() => {});

  return Response.json({ data: grantRow }, { status: 201 });
}
