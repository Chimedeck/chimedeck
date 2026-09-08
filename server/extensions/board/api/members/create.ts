// POST /api/v1/boards/:id/members — add a workspace member to the board with an explicit role.
// Requires board ADMIN role (or workspace OWNER/ADMIN).
// Body: { userId: string, role?: 'ADMIN' | 'MEMBER' }
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
type BoardMemberRequest = BoardVisibilityScopedRequest & {
  board: NonNullable<BoardVisibilityScopedRequest['board']>;
  currentUser?: { id: string };
};
type BoardMemberRow = { board_id: string; user_id: string; role: string };
type MembershipRow = { user_id: string; workspace_id: string; role: string };
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

  let body: { userId?: string; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be valid JSON' } },
      { status: 400 },
    );
  }

  const { userId } = body;
  if (!userId || typeof userId !== 'string') {
    return Response.json(
      { name: 'missing-user-id', data: { message: 'userId is required' } },
      { status: 400 },
    );
  }

  const role: BoardMemberRole = VALID_ROLES.has(body.role as BoardMemberRole)
    ? (body.role as BoardMemberRole)
    : 'MEMBER';

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

  // Idempotency — update role if already a member.
  const existing = await db<BoardMemberRow>('board_members')
    .where({ board_id: boardId, user_id: userId })
    .first<BoardMemberRow | undefined>();
  if (existing) {
    await db('board_members')
      .where({ board_id: boardId, user_id: userId })
      .update({ role, updated_at: new Date().toISOString() });
  } else {
    await db('board_members').insert({
      id: randomUUID(),
      board_id: boardId,
      user_id: userId,
      role,
    });
  }

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

  return Response.json({ data: member }, { status: existing ? 200 : 201 });
}
