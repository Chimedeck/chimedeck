// POST /api/v1/boards/:id/members — add a workspace member to the board with an explicit role.
// Requires board ADMIN role (or workspace OWNER/ADMIN).
// Body: { userId?: string, email?: string, role?: 'ADMIN' | 'MEMBER' } — one of
// userId or email identifies the target; userId wins when both are supplied.
// Adding someone who is already a board member is a conflict, not a role change:
// use PATCH /boards/:id/members/:userId, which enforces the last-ADMIN invariant.
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import type { BoardVisibilityScopedRequest } from '../../../../middlewares/boardVisibility';
import {
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { dispatchEvent } from '../../../../mods/events/dispatch';

type BoardMemberRole = 'ADMIN' | 'MEMBER';
const VALID_ROLES = new Set<BoardMemberRole>(['ADMIN', 'MEMBER']);

// Roles are stored uppercase; accept any case from clients and default to MEMBER
// when the caller omits the field entirely.
function normalizeRole(role: string | undefined): BoardMemberRole {
  if (role === undefined) return 'MEMBER';
  return (typeof role === 'string' ? role.toUpperCase() : role) as BoardMemberRole;
}
type BoardMemberRequest = BoardVisibilityScopedRequest & {
  board: NonNullable<BoardVisibilityScopedRequest['board']>;
  currentUser?: { id: string };
};
type BoardMemberRow = { board_id: string; user_id: string; role: string };
type MembershipRow = { user_id: string; workspace_id: string; role: string };
type UserRow = { id: string; email: string };
type MemberResponseRow = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  role: string;
  created_at: Date | string;
};

export async function handleAddBoardMember(req: Request, boardId: string): Promise<Response> {
  const scopedReq = req as BoardMemberRequest;
  const board = scopedReq.board;
  const currentUserId = scopedReq.currentUser?.id;

  if (!currentUserId) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Authentication required' } },
      { status: 401 },
    );
  }

  // Board membership can be managed by workspace ADMIN+ or explicit board ADMIN/OWNER.
  const workspaceRoleError = requireRole(scopedReq as WorkspaceScopedRequest, 'ADMIN');
  if (workspaceRoleError) {
    const actingBoardMember = await db<BoardMemberRow>('board_members')
      .where({ board_id: boardId, user_id: currentUserId })
      .first<BoardMemberRow | undefined>();
    const actingBoardRole = actingBoardMember?.role;
    const isBoardAdmin = actingBoardRole === 'ADMIN' || actingBoardRole === 'OWNER';
    if (!isBoardAdmin) return workspaceRoleError;
  }

  let body: { userId?: string; email?: string; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be valid JSON' } },
      { status: 400 },
    );
  }

  // The target is identified by userId, or by the email of an existing account.
  // userId wins when both are present.
  let userId = typeof body.userId === 'string' ? body.userId : undefined;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;

  if (!userId && email) {
    const user = await db<UserRow>('users').where({ email }).first<UserRow | undefined>();
    if (!user) {
      return Response.json(
        {
          name: 'user-not-found',
          data: { message: `No account found for ${email}. Ask them to sign up first.` },
        },
        { status: 404 },
      );
    }
    userId = user.id;
  }

  if (!userId) {
    return Response.json(
      { name: 'missing-user-id', data: { message: 'userId or email is required' } },
      { status: 400 },
    );
  }

  const role: BoardMemberRole = normalizeRole(body.role);
  if (body.role !== undefined && !VALID_ROLES.has(role)) {
    return Response.json(
      { name: 'invalid-role', data: { message: 'role must be ADMIN or MEMBER' } },
      { status: 400 },
    );
  }

  // Target user must be a workspace member (not a guest) to be added to a board.
  const workspaceMembership = await db<MembershipRow>('memberships')
    .where({ user_id: userId, workspace_id: board.workspace_id })
    .whereNot('role', 'GUEST')
    .first<MembershipRow | undefined>();

  if (!workspaceMembership) {
    return Response.json(
      { name: 'user-not-workspace-member', data: { message: 'User must be a workspace member before being added to a board' } },
      { status: 422 },
    );
  }

  // Adding an existing member is a conflict — changing a role goes through
  // PATCH /boards/:id/members/:userId, which protects the last board ADMIN.
  const existing = await db<BoardMemberRow>('board_members')
    .where({ board_id: boardId, user_id: userId })
    .first<BoardMemberRow | undefined>();
  if (existing) {
    return Response.json(
      {
        name: 'board-member-exists',
        data: {
          message:
            'User is already a member of this board. Use PATCH /api/v1/boards/:boardId/members/:userId to change their role.',
        },
      },
      { status: 409 },
    );
  }

  await db('board_members').insert({
    id: randomUUID(),
    board_id: boardId,
    user_id: userId,
    role,
  });

  const member = await db<MemberResponseRow>('board_members as bm')
    .join('users as u', 'bm.user_id', 'u.id')
    .where({ 'bm.board_id': boardId, 'bm.user_id': userId })
    .select(
      db.raw('u.id as id'),
      'u.email',
      db.raw("COALESCE(u.name, u.email) as name"),
      'u.nickname',
      'bm.role',
      'bm.created_at',
    )
    .first<MemberResponseRow>();

  dispatchEvent({
    type: 'board_member_added',
    boardId,
    entityId: boardId,
    actorId: currentUserId,
    payload: { userId, role },
  }).catch(() => {});

  return Response.json({ data: member }, { status: 201 });
}
