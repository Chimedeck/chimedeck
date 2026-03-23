// PATCH /api/v1/cards/:id/money — update the card's money/price fields.
// [why] Dedicated endpoint so external API clients can set price/budget without touching
//       other card fields, keeping the contract minimal and auditable.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { writeActivity } from '../../activity/mods/write';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';

// ISO 4217 3-letter uppercase currency code
const CURRENCY_RE = /^[A-Z]{3}$/;

export async function handlePatchCardMoney(req: Request, cardId: string): Promise<Response> {
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

  let body: {
    amount?: number | null;
    currency?: string | null;
    label?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (body.amount === undefined && body.currency === undefined && body.label === undefined) {
    return Response.json(
      { name: 'bad-request', data: { message: 'At least one of amount, currency, or label must be provided' } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.amount !== undefined) {
    if (body.amount === null) {
      updates.amount = null;
      // Clearing amount also clears currency
      updates.currency = null;
    } else {
      if (typeof body.amount !== 'number' || Number.isNaN(body.amount)) {
        return Response.json(
          { name: 'bad-request', data: { message: 'amount must be a number or null' } },
          { status: 400 },
        );
      }
      if (body.amount < 0) {
        return Response.json(
          { name: 'bad-request', data: { message: 'amount must be non-negative' } },
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
          { name: 'bad-request', data: { message: 'currency must be a 3-letter ISO 4217 code (e.g. USD)' } },
          { status: 400 },
        );
      }
      updates.currency = body.currency;
    }
  }

  if (body.label !== undefined) {
    if (body.label === null) {
      updates.money_label = null;
    } else {
      if (typeof body.label !== 'string' || body.label.trim() === '') {
        return Response.json(
          { name: 'bad-request', data: { message: 'label must be a non-empty string or null' } },
          { status: 400 },
        );
      }
      if (body.label.trim().length > 100) {
        return Response.json(
          { name: 'bad-request', data: { message: 'label must be ≤ 100 characters' } },
          { status: 400 },
        );
      }
      updates.money_label = body.label.trim();
    }
  }

  // Default currency to USD when amount is set and no currency is stored or provided
  if (updates.amount != null && updates.currency === undefined) {
    const existing = await db('cards').where({ id: cardId }).select('currency').first();
    if (!existing?.currency) {
      updates.currency = 'USD';
    }
  }

  const rows = await db('cards')
    .where({ id: cardId })
    .update(updates, ['id', 'amount', 'currency', 'money_label']);

  const row = rows[0] as { id: string; amount: number | null; currency: string | null; money_label: string | null };

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  await dispatchEvent({
    type: 'card.updated',
    boardId: board.id,
    entityId: cardId,
    actorId,
    payload: { card: { id: row.id, amount: row.amount, currency: row.currency, label: row.money_label } },
  });

  await writeActivity({
    entityType: 'card',
    entityId: cardId,
    boardId: board.id,
    action: 'card.money.updated',
    actorId,
    payload: { amount: row.amount, currency: row.currency, label: row.money_label },
  });

  return Response.json({
    data: {
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      label: row.money_label,
    },
  });
}
