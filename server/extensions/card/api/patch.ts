// PATCH /api/v1/cards/:id/description — idempotent description save for offline replay.
// [why] A separate endpoint for description-only saves lets the offline queue send a
//        replay request with an idempotency_key and client_updated_at.  If the server
//        detects the mutation was already applied (card.updated_at >= client_updated_at
//        with the same idempotency_key stored on the draft), it returns the current card
//        without re-emitting activity or WS events, preventing duplicate feed entries.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';
import { writeActivity } from '../../activity/mods/write';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { syncMentions } from '../../../common/mentions/sync';
import { createNotificationsForMentions } from '../../notifications/mods/createNotifications';
import { sanitizeRichText } from '../../../common/sanitize';

export async function handlePatchCardDescription(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const cardReq = req as CardScopedRequest;
  const writableError = await requireCardWritable(cardReq, cardId);
  if (writableError) return writableError;

  const board = cardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: {
    description?: string | null;
    idempotency_key?: string;
    client_updated_at?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (body.description === undefined) {
    return Response.json(
      { error: { code: 'bad-request', message: 'description is required' } },
      { status: 400 },
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  // [why] Idempotency check for offline replay: if the client provides both an
  //        idempotency_key and a client_updated_at, we compare against the card's
  //        current updated_at.  If the card was updated at or after the client's
  //        timestamp, the description save was already applied — return the current
  //        card without re-applying or emitting duplicate events.
  if (body.idempotency_key !== undefined && body.client_updated_at !== undefined) {
    if (typeof body.idempotency_key !== 'string' || body.idempotency_key.trim() === '') {
      return Response.json(
        { error: { code: 'bad-request', message: 'idempotency_key must be a non-empty string' } },
        { status: 400 },
      );
    }

    const clientTs = new Date(body.client_updated_at);
    if (isNaN(clientTs.getTime())) {
      return Response.json(
        { error: { code: 'bad-request', message: 'client_updated_at must be a valid ISO 8601 timestamp' } },
        { status: 400 },
      );
    }

    const current = await db('cards').where({ id: cardId }).first();
    if (current) {
      const serverTs = new Date(current.updated_at);
      // [why] If the server already has a newer (or equal) timestamp, treat the
      //        request as a duplicate replay — return the current state without
      //        side effects to avoid double activity entries.
      if (serverTs >= clientTs) {
        return Response.json({ data: current });
      }
    }
  }

  const sanitizedDescription = body.description
    ? sanitizeRichText(body.description.trim())
    : null;

  const updatedRows = await db.transaction(async (trx) => {
    const rows = await trx('cards')
      .where({ id: cardId })
      .update({ description: sanitizedDescription, updated_at: new Date().toISOString() }, ['*']);

    if (rows[0]) {
      const { addedUserIds } = await syncMentions({
        trx,
        sourceType: 'card_description',
        sourceId: cardId,
        text: sanitizedDescription ?? '',
        boardId: board.id,
        mentionedByUserId: actorId,
      });

      await createNotificationsForMentions({
        trx,
        addedUserIds,
        actorId,
        sourceType: 'card_description',
        sourceId: cardId,
        cardId,
        boardId: board.id,
        cardTitle: rows[0].title,
        boardName: board.title,
      });
    }

    return rows;
  });

  await Promise.all([
    dispatchEvent({
      type: 'card.updated',
      boardId: board.id,
      entityId: cardId,
      actorId,
      payload: { card: updatedRows[0] },
    }),
    writeActivity({
      entityType: 'card',
      entityId: cardId,
      boardId: board.id,
      action: 'card.description.updated',
      actorId,
      payload: { cardId, cardTitle: updatedRows[0]?.title },
    }),
  ]);

  return Response.json({ data: updatedRows[0] });
}
