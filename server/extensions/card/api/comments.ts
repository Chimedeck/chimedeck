// POST /api/v1/cards/:id/comments — external API surface for adding a card comment.
// [why] Thin wrapper that accepts { text } (external API contract) and returns the slim
//       { data: { id, cardId, userId, text, createdAt } } shape for MCP/CLI consumers.
//       The richer internal endpoint at comment/api/create.ts handles UI-facing flows.
import { randomUUID } from 'node:crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { writeActivity } from '../../activity/mods/write';
import { sanitizeRichText } from '../../../common/sanitize';
import { syncMentions } from '../../../common/mentions/sync';
import { createNotificationsForMentions } from '../../notifications/mods/createNotifications';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireCardWritable, type CardScopedRequest } from '../middlewares/requireCardWritable';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';

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

  let body: { text?: string; content?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  // [why] Accept both `content` (UI) and `text` (MCP/CLI external contract)
  const rawText = body.content ?? body.text;
  if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'content is required' } },
      { status: 400 },
    );
  }

  if (rawText.trim().length > 50000) {
    return Response.json(
      { name: 'bad-request', data: { message: 'content must be ≤ 50 000 characters' } },
      { status: 400 },
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  const id = randomUUID();
  const content = sanitizeRichText(rawText.trim());
  const now = new Date().toISOString();

  const card = await db('cards').where({ id: cardId }).select('title').first();

  await db.transaction(async (trx) => {
    await trx('comments').insert({
      id,
      card_id: cardId,
      user_id: actorId,
      content,
      version: 1,
      deleted: false,
      created_at: now,
      updated_at: now,
    });

    const { addedUserIds } = await syncMentions({
      trx,
      sourceType: 'comment',
      sourceId: id,
      text: content,
      boardId: board.id,
      mentionedByUserId: actorId,
    });

    await createNotificationsForMentions({
      trx,
      addedUserIds,
      actorId,
      sourceType: 'comment',
      sourceId: id,
      cardId,
      boardId: board.id,
      cardTitle: card?.title,
      boardName: board.title,
    });
  });

  const author = await db('users').where({ id: actorId }).select('name', 'email', 'avatar_url').first();

  const rawPreview = content.replaceAll(/<[^>]+>/g, '');
  const commentPreview = rawPreview.length > 120 ? rawPreview.slice(0, 117) + '…' : rawPreview;

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
      payload: { commentId: id, cardId, cardTitle: card?.title ?? '', commentPreview },
    }),
  ]);

  return Response.json(
    {
      data: {
        id,
        card_id: cardId,
        user_id: actorId,
        content,
        version: 1,
        deleted: false,
        created_at: now,
        updated_at: now,
        author_name: author?.name ?? author?.email ?? null,
        author_email: author?.email ?? null,
        author_avatar_url: buildAvatarProxyUrl({ userId: actorId, avatarUrl: author?.avatar_url ?? null }),
      },
    },
    { status: 201 },
  );
}
