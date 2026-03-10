// PATCH /api/v1/cards/:id — update amount and/or currency; min role: MEMBER.
// Also validates ISO 4217 currency codes and emits card.money.updated activity + WS event.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';
import { writeActivity } from '../../activity/mods/write';
import { writeEvent } from '../../../mods/events/write';

// ISO 4217 3-letter currency code regex
const CURRENCY_RE = /^[A-Z]{3}$/;

export async function handlePatchCard(req: Request, cardId: string): Promise<Response> {
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

  let body: { amount?: number | null; currency?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.amount !== undefined) {
    if (body.amount === null) {
      updates.amount = null;
      updates.currency = null;
    } else {
      if (typeof body.amount !== 'number' || isNaN(body.amount)) {
        return Response.json(
          { error: { code: 'bad-request', message: 'amount must be a number or null' } },
          { status: 400 },
        );
      }
      if (body.amount < 0) {
        return Response.json(
          { error: { code: 'bad-request', message: 'amount must be non-negative' } },
          { status: 400 },
        );
      }
      updates.amount = body.amount;
    }
  }

  if (body.currency !== undefined && body.amount !== null) {
    if (body.currency === null) {
      updates.currency = null;
    } else {
      if (typeof body.currency !== 'string' || !CURRENCY_RE.test(body.currency)) {
        return Response.json(
          { error: { code: 'bad-request', message: 'currency must be a 3-letter ISO 4217 code (e.g. USD)' } },
          { status: 400 },
        );
      }
      updates.currency = body.currency;
    }
  }

  // Default currency to USD when amount is set but no currency provided
  if (updates.amount != null && updates.currency === undefined) {
    const existing = await db('cards').where({ id: cardId }).first();
    if (!existing?.currency) {
      updates.currency = 'USD';
    }
  }

  const [updated] = await db('cards').where({ id: cardId }).update(updates, ['*']);

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  const moneyChanged = body.amount !== undefined || (body.currency !== undefined && body.amount !== null);
  if (moneyChanged) {
    await writeActivity({
      entityType: 'card',
      entityId: cardId,
      boardId: board.id,
      action: 'card.money.updated',
      actorId,
      payload: { amount: updated.amount, currency: updated.currency },
    });

    await writeEvent({
      type: 'card_updated',
      boardId: board.id,
      entityId: cardId,
      actorId,
      payload: { card: updated },
    });
  }

  return Response.json({ data: updated });
}
