// DELETE /api/v1/boards/:id — hard-delete a board; min role: ADMIN.
// Requires confirm:true in the request body when the board contains lists or cards.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { publishBoardDeleted } from '../../events/mods/publishBoardDeleted';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { guestGuard } from '../../../middlewares/guestGuard';

export async function handleDeleteBoard(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const guestError = guestGuard(scopedReq);
  if (guestError) return guestError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  // Count nested content to determine if confirmation is required.
  const listRows = await db('lists').where({ board_id: boardId }).count('id as count').first();
  const cardRows = await db('cards').whereIn(
    'list_id',
    db('lists').where({ board_id: boardId }).select('id'),
  ).count('id as count').first();

  const listCount = Number(listRows?.count ?? 0);
  const cardCount = Number(cardRows?.count ?? 0);

  if (listCount > 0 || cardCount > 0) {
    // Parse request body — DELETE with a body is valid per HTTP spec.
    let body: { confirm?: boolean } = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text) as typeof body;
    } catch {
      // Treat unparseable body as no confirmation.
    }

    if (!body.confirm) {
      return Response.json(
        { name: 'delete-requires-confirmation', data: { listCount, cardCount } },
        { status: 409 },
      );
    }
  }

  await db('boards').where({ id: boardId }).del();

  // Publish board_deleted event and notify all workspace members in real-time.
  await publishBoardDeleted({
    boardId,
    workspaceId: board.workspace_id,
    actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system',
  });

  return new Response(null, { status: 204 });
}
