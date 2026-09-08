// POST /api/v1/boards/:id/members/join — self-join a board.
// Allows any non-GUEST workspace member to add themselves to a WORKSPACE or PUBLIC board
// so they appear in mention suggestions and the members list.
// PRIVATE boards are rejected — only admins can add members to those.
import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import type { BoardVisibilityScopedRequest } from '../../../../middlewares/boardVisibility';
import { dispatchEvent } from '../../../../mods/events/dispatch';

type JoinBoardRequest = BoardVisibilityScopedRequest & {
  board: NonNullable<BoardVisibilityScopedRequest['board']>;
  currentUser: { id: string };
};
type MembershipRow = { user_id: string; workspace_id: string; role: string };
type BoardMemberRow = { board_id: string; user_id: string };
type JoinedMemberRow = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  role: string;
  created_at: Date | string;
};

export async function handleJoinBoard(req: Request, boardId: string): Promise<Response> {
  const scopedReq = req as JoinBoardRequest;
  const board = scopedReq.board;
  const currentUser = scopedReq.currentUser;

  // Verify the caller is a non-GUEST workspace member.
  const membership = await db<MembershipRow>('memberships')
    .where({ user_id: currentUser.id, workspace_id: board.workspace_id })
    .whereNot('role', 'GUEST')
    .first<MembershipRow | undefined>();

  if (!membership) {
    return Response.json(
      { name: 'not-a-workspace-member', data: { message: 'You must be a workspace member to join this board.' } },
      { status: 403 },
    );
  }

  // [why] Workspace ADMIN/OWNER have authority over all boards regardless of visibility.
  // Regular members (MEMBER/VIEWER) can only self-join open (WORKSPACE/PUBLIC) boards.
  const isWorkspaceAdminOrOwner =
    membership.role === 'OWNER' || membership.role === 'ADMIN';

  if (board.visibility === 'PRIVATE' && !isWorkspaceAdminOrOwner) {
    return Response.json(
      { name: 'board-is-private', data: { message: 'You can only self-join WORKSPACE or PUBLIC boards. Ask a board admin to add you to this board.' } },
      { status: 403 },
    );
  }

  const existing = await db<BoardMemberRow>('board_members')
    .where({ board_id: boardId, user_id: currentUser.id })
    .first<BoardMemberRow | undefined>();

  if (existing) {
    // Already a member — idempotent, return current membership.
    const member = await db<JoinedMemberRow>('board_members as bm')
      .join('users as u', 'bm.user_id', 'u.id')
      .where({ 'bm.board_id': boardId, 'bm.user_id': currentUser.id })
      .select(
        db.raw('u.id as id'),
        'u.email',
        db.raw("COALESCE(u.name, u.email) as name"),
        'u.nickname',
        'bm.role',
        'bm.created_at',
      )
      .first<JoinedMemberRow>();
    return Response.json({ data: member });
  }

  await db('board_members').insert({
    id: randomUUID(),
    board_id: boardId,
    user_id: currentUser.id,
    // [why] Self-joined members get MEMBER role — they can edit cards but not manage the board.
    role: 'MEMBER',
  });

  const member = await db<JoinedMemberRow>('board_members as bm')
    .join('users as u', 'bm.user_id', 'u.id')
    .where({ 'bm.board_id': boardId, 'bm.user_id': currentUser.id })
    .select(
      db.raw('u.id as id'),
      'u.email',
      db.raw("COALESCE(u.name, u.email) as name"),
      'u.nickname',
      'bm.role',
      'bm.created_at',
    )
    .first<JoinedMemberRow>();

  dispatchEvent({
    type: 'board_member_added',
    boardId,
    entityId: boardId,
    actorId: currentUser.id,
    payload: { userId: currentUser.id, role: 'MEMBER' },
  }).catch(() => {});

  return Response.json({ data: member }, { status: 201 });
}
