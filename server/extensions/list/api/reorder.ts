// POST /api/v1/boards/:boardId/lists/reorder — batch position update; min role: MEMBER.
// Validates that order.length === active (non-archived) list count, then assigns
// fresh lexicographic positions to every list in the supplied order.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { writeEvent } from '../../../mods/events/write';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';
import { generatePositions } from '../mods/fractional';

export async function handleReorderLists(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, boardId);
  if (writableError) return writableError;

  const board = boardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { order?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.order)) {
    return Response.json(
      { error: { code: 'bad-request', message: 'order must be an array of list IDs' } },
      { status: 400 },
    );
  }

  // Fetch active lists for this board
  const activeLists = await db('lists').where({ board_id: boardId, archived: false });

  // Validate count matches — archived lists are excluded (requirements §5.4)
  if (body.order.length !== activeLists.length) {
    return Response.json(
      {
        name: 'reorder-count-mismatch',
        data: {
          message: `order has ${body.order.length} items but board has ${activeLists.length} active lists`,
        },
      },
      { status: 400 },
    );
  }

  // Validate all IDs belong to this board
  const activeIds = new Set(activeLists.map((l) => l.id as string));
  for (const id of body.order) {
    if (!activeIds.has(id)) {
      return Response.json(
        { error: { code: 'list-board-mismatch', message: `List ${id} does not belong to this board` } },
        { status: 400 },
      );
    }
  }

  // Assign fresh well-spaced positions
  const positions = generatePositions(body.order.length);

  await db.transaction(async (trx) => {
    for (let i = 0; i < body.order!.length; i++) {
      await trx('lists')
        .where({ id: body.order![i] })
        .update({ position: positions[i] });
    }
  });

  const updatedLists = await db('lists')
    .where({ board_id: boardId, archived: false })
    .orderBy('position', 'asc');

  // Send full lists array so client can reorder from authoritative positions
  await writeEvent({ type: 'list_reordered', boardId, entityId: boardId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { boardId, lists: updatedLists } });

  return Response.json({ data: updatedLists });
}
