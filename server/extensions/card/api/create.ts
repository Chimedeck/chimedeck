// POST /api/v1/lists/:listId/cards — create a new card; min role: MEMBER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';
import { between, HIGH_SENTINEL } from '../../list/mods/fractional';
import { sanitizeText, sanitizeRichText } from '../../../common/sanitize';
import { emitCardCreated } from '../../activity/mods/createActivityEvent';

export async function handleCreateCard(req: Request, listId: string): Promise<Response> {
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

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  let body: { title?: string; description?: string; start_date?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return Response.json(
      { error: { code: 'bad-request', message: 'title is required' } },
      { status: 400 },
    );
  }

  if (body.title.trim().length > 512) {
    return Response.json(
      { error: { code: 'card-title-too-long', message: 'title must be ≤ 512 characters' } },
      { status: 400 },
    );
  }

  if (body.start_date !== undefined && body.start_date !== null) {
    const parsed = new Date(body.start_date);
    if (isNaN(parsed.getTime())) {
      return Response.json(
        { error: { code: 'bad-request', message: 'start_date must be a valid ISO 8601 date string or null' } },
        { status: 400 },
      );
    }
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
    title: sanitizeText(body.title.trim()),
    description: body.description ? sanitizeRichText(body.description.trim()) : null,
    position,
    archived: false,
    start_date: body.start_date ?? null,
  });

  const card = await db('cards').where({ id }).first();

  const actorId = (req as AuthenticatedRequest).currentUser?.id ?? 'system';

  // Broadcast the full card object so clients can update their local state immediately
  await Promise.all([
    dispatchEvent({ type: 'card.created', boardId: list.board_id, entityId: id, actorId, payload: { card, listId } }),
    emitCardCreated({
      actorId,
      cardId: id,
      cardTitle: card.title,
      listId,
      listName: list.title ?? null,
      boardId: board.id,
      workspaceId: board.workspace_id,
      ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    }),
  ]);

  return Response.json({ data: card }, { status: 201 });
}
