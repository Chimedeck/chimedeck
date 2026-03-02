// POST /api/v1/lists/:listId/cards — create a new card; min role: MEMBER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';
import { between, HIGH_SENTINEL } from '../../list/mods/fractional';

export async function handleCreateCard(req: Request, listId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const list = await db('lists').where({ id: listId }).first();
  if (!list) {
    return Response.json(
      { name: 'list-not-found', data: { message: 'List not found' } },
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

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { title?: string; description?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'title is required' } },
      { status: 400 },
    );
  }

  if (body.title.trim().length > 512) {
    return Response.json(
      { name: 'card-title-too-long', data: { message: 'title must be ≤ 512 characters' } },
      { status: 400 },
    );
  }

  // Append to end of list
  const lastCard = await db('cards')
    .where({ list_id: listId, archived: false })
    .orderBy('position', 'desc')
    .first();

  const position = between(lastCard ? lastCard.position : '', HIGH_SENTINEL);

  const id = randomUUID();
  await db('cards').insert({
    id,
    list_id: listId,
    title: body.title.trim(),
    description: body.description?.trim() ?? null,
    position,
    archived: false,
  });

  const card = await db('cards').where({ id }).first();

  // Stub event emission — replaced by activity log in sprint 10.
  console.log('[event] card_created', { cardId: id, listId, boardId: list.board_id });

  return Response.json({ data: card }, { status: 201 });
}
