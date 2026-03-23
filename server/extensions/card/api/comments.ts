// POST /api/v1/cards/:id/comments — external API surface for adding a card comment.
// [why] Thin wrapper that accepts { text } (external API contract) and returns the slim
//       { data: { id, cardId, userId, text, createdAt } } shape for MCP/CLI consumers.
//       The richer internal endpoint at comment/api/create.ts handles UI-facing flows.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { writeActivity } from '../../activity/mods/write';
import { sanitizeRichText } from '../../../common/sanitize';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';

export async function handleCreateCardComment(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const cardReq = req as CardScopedRequest;
  const writableError = await requireCardWritable(cardReq, cardId);
  if (writableError) return writableError;

  const board = cardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  let body: { text?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'text is required' } },
      { status: 400 },
    );
  }

  if (body.text.trim().length > 50000) {
    return Response.json(
      { name: 'bad-request', data: { message: 'text must be ≤ 50 000 characters' } },
      { status: 400 },
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  const id = randomUUID();
  const content = sanitizeRichText(body.text.trim());
  const now = new Date().toISOString();

  await db('comments').insert({
    id,
    card_id: cardId,
    user_id: actorId,
    content,
    version: 1,
    deleted: false,
    created_at: now,
    updated_at: now,
  });

  const card = await db('cards').where({ id: cardId }).select('title').first();

  await Promise.all([
    dispatchEvent({
      type: 'comment_added',
      boardId: board.id,
      entityId: cardId,
      actorId,
      payload: { commentId: id, cardId, cardTitle: card?.title ?? '' },
    }),
    writeActivity({
      entityType: 'card',
      entityId: cardId,
      boardId: board.id,
      action: 'comment_added',
      actorId,
      payload: { commentId: id, cardId, cardTitle: card?.title ?? '' },
    }),
  ]);

  return Response.json(
    {
      data: {
        id,
        cardId,
        userId: actorId,
        text: body.text.trim(),
        createdAt: now,
      },
    },
    { status: 201 },
  );
}
