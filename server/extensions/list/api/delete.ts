// DELETE /api/v1/lists/:id — hard-delete a list (cascades cards); min role: ADMIN.
// Requires confirm:true in the request body when the list contains cards.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { writeEvent } from '../../../mods/events/write';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';

export async function handleDeleteList(req: Request, listId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const list = await db('lists').where({ id: listId }).first();
  if (!list) {
    return Response.json(
      { error: { code: 'list-not-found', message: 'List not found' } },
      { status: 404 },
    );
  }

  const boardReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, list.board_id);
  if (writableError) return writableError;

  const board = boardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  // Count cards in the list to determine if confirmation is required.
  const cardRows = await db('cards').where({ list_id: listId }).count('id as count').first();
  const cardCount = Number(cardRows?.count ?? 0);

  if (cardCount > 0) {
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
        { name: 'delete-requires-confirmation', data: { cardCount } },
        { status: 409 },
      );
    }
  }

  await db('lists').where({ id: listId }).del();

  // Stub event emission.
  await writeEvent({ type: 'list_deleted', boardId: list.board_id, entityId: listId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: {} });

  return new Response(null, { status: 204 });
}
