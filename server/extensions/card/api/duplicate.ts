// POST /api/v1/cards/:id/duplicate — duplicate card within same list; min role: MEMBER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';
import { between, HIGH_SENTINEL } from '../../list/mods/fractional';

export async function handleDuplicateCard(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const cardReq = req as CardScopedRequest;
  const writableError = await requireCardWritable(cardReq, cardId);
  if (writableError) return writableError;

  const card = cardReq.card!;
  const board = cardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  // Insert copy immediately after the source card
  const cardsAfter = await db('cards')
    .where({ list_id: card.list_id, archived: false })
    .where('position', '>', card.position)
    .orderBy('position', 'asc')
    .first();

  const position = between(card.position, cardsAfter ? cardsAfter.position : HIGH_SENTINEL);

  const newId = randomUUID();
  await db('cards').insert({
    id: newId,
    list_id: card.list_id,
    title: card.title,
    description: card.description,
    position,
    archived: false,
    due_date: card.due_date,
  });

  const duplicate = await db('cards').where({ id: newId }).first();

  await dispatchEvent({ type: 'card.duplicated', boardId: board.id, entityId: newId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { sourceId: cardId } });

  return Response.json({ data: duplicate }, { status: 201 });
}
