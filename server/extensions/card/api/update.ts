// PATCH /api/v1/cards/:id — update title, description, due_date, amount, or currency; min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { writeActivity } from '../../activity/mods/write';
import { syncMentions } from '../../../common/mentions/sync';
import { createNotificationsForMentions } from '../../notifications/mods/createNotifications';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';
import { sanitizeText, sanitizeRichText } from '../../../common/sanitize';
import { resolveCoverImageUrl } from '../../../common/cards/cover';
import { dispatchDirectCardNotification } from '../../notifications/mods/boardActivityDispatch';

// ISO 4217 3-letter currency code regex
const CURRENCY_RE = /^[A-Z]{3}$/;
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const CARD_COVER_SIZES = new Set(['SMALL', 'FULL']);

export async function handleUpdateCard(req: Request, cardId: string): Promise<Response> {
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
    title?: string;
    description?: string;
    due_date?: string | null;
    due_complete?: boolean;
    start_date?: string | null;
    amount?: number | null;
    currency?: string | null;
    cover_attachment_id?: string | null;
    cover_color?: string | null;
    cover_size?: 'SMALL' | 'FULL';
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return Response.json(
        { error: { code: 'bad-request', message: 'title must be a non-empty string' } },
        { status: 400 },
      );
    }
    if (body.title.trim().length > 512) {
      return Response.json(
        { error: { code: 'card-title-too-long', message: 'title must be ≤ 512 characters' } },
        { status: 400 },
      );
    }
    updates.title = sanitizeText(body.title.trim());
  }

  if (body.description !== undefined) {
    updates.description = body.description ? sanitizeRichText(body.description.trim()) : null;
  }

  if (body.due_date !== undefined) {
    updates.due_date = body.due_date;
    // Clearing the due date also resets the done flag
    if (body.due_date === null) updates.due_complete = false;
  }

  if (body.due_complete !== undefined) {
    if (typeof body.due_complete !== 'boolean') {
      return Response.json(
        { error: { code: 'bad-request', message: 'due_complete must be a boolean' } },
        { status: 400 },
      );
    }
    updates.due_complete = body.due_complete;
  }

  if (body.start_date !== undefined) {
    if (body.start_date !== null) {
      const parsed = new Date(body.start_date);
      if (Number.isNaN(parsed.getTime())) {
        return Response.json(
          { error: { code: 'bad-request', message: 'start_date must be a valid ISO 8601 date string or null' } },
          { status: 400 },
        );
      }
    }
    updates.start_date = body.start_date;
  }

  if (body.amount !== undefined) {
    if (body.amount === null) {
      updates.amount = null;
      updates.currency = null;
    } else {
      if (typeof body.amount !== 'number' || Number.isNaN(body.amount)) {
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

  if (body.cover_attachment_id !== undefined) {
    if (body.cover_attachment_id === null) {
      updates.cover_attachment_id = null;
    } else {
      if (typeof body.cover_attachment_id !== 'string' || body.cover_attachment_id.trim() === '') {
        return Response.json(
          { error: { code: 'bad-request', message: 'cover_attachment_id must be a non-empty string or null' } },
          { status: 400 },
        );
      }

      const attachment = await db('attachments')
        .where({ id: body.cover_attachment_id, card_id: cardId, type: 'FILE' })
        .first();

      if (!attachment || typeof attachment.mime_type !== 'string' || !attachment.mime_type.startsWith('image/')) {
        return Response.json(
          { error: { code: 'invalid-cover-attachment', message: 'cover_attachment_id must reference an image attachment on this card' } },
          { status: 400 },
        );
      }

      updates.cover_attachment_id = body.cover_attachment_id;
    }
  }

  if (body.cover_color !== undefined) {
    if (body.cover_color === null) {
      updates.cover_color = null;
    } else {
      if (typeof body.cover_color !== 'string' || !HEX_COLOR_RE.test(body.cover_color)) {
        return Response.json(
          { error: { code: 'bad-request', message: 'cover_color must be a hex color string like #1D4ED8 or null' } },
          { status: 400 },
        );
      }
      updates.cover_color = body.cover_color;
    }
  }

  if (body.cover_size !== undefined) {
    if (!CARD_COVER_SIZES.has(body.cover_size)) {
      return Response.json(
        { error: { code: 'bad-request', message: 'cover_size must be SMALL or FULL' } },
        { status: 400 },
      );
    }
    updates.cover_size = body.cover_size;
  }

  // Default currency to USD when amount is set but no currency provided or stored
  if (updates.amount != null && updates.currency === undefined) {
    const existing = await db('cards').where({ id: cardId }).first();
    if (!existing?.currency) {
      updates.currency = 'USD';
    }
  }

  const actorId = (req as AuthenticatedRequest).currentUser?.id ?? 'system';

  // Wrap card update + mention sync in a single transaction
  const updated = await db.transaction(async (trx) => {
    const rows = await trx('cards').where({ id: cardId }).update(updates, ['*']);

    // Sync @mentions when description is being saved
    if (body.description !== undefined && rows[0]) {
      const { addedUserIds } = await syncMentions({
        trx,
        sourceType: 'card_description',
        sourceId: cardId,
        text: rows[0].description ?? '',
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
        cardTitle: rows[0]?.title,
        boardName: board.title,
      });
    }

    return rows;
  });

  const cardRow = updated[0] as Record<string, unknown>;
  const cardWithCover = await resolveCoverImageUrl(updated[0] as { id: string; cover_attachment_id?: string | null });

  // Use 'card_updated' to match client useBoardSync handler; send full card object
  await dispatchEvent({ type: 'card.updated', boardId: board.id, entityId: cardId, actorId, payload: { card: cardWithCover } });

  // Fire-and-forget board activity notification for card_updated
  const changedFields = Object.keys(updates).filter((k) => k !== 'updated_at');
  dispatchDirectCardNotification({
    payload: { type: 'card_updated', cardTitle: (cardRow.title as string) ?? '', changedFields },
    boardId: board.id,
    cardId,
    actorId,
  }).catch(() => {});

  // Emit activity event when money fields change
  if (body.amount !== undefined || (body.currency !== undefined && body.amount !== null)) {
    await writeActivity({
      entityType: 'card',
      entityId: cardId,
      boardId: board.id,
      action: 'card.money.updated',
      actorId,
      payload: { amount: cardWithCover.amount, currency: cardWithCover.currency },
    });
  }

  return Response.json({ data: cardWithCover });
}
