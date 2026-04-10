// POST /api/v1/cards/:id/comments — add a comment; min role: MEMBER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { dispatchEvent } from '../../../mods/events/dispatch';
import { writeActivity } from '../../activity/mods/write';
import { publisher } from '../../../mods/pubsub/publisher';
import { syncMentions } from '../../../common/mentions/sync';
import { sanitizeRichText } from '../../../common/sanitize';
import { createNotificationsForMentions } from '../../notifications/mods/createNotifications';
import { dispatchDirectCardNotification } from '../../notifications/mods/boardActivityDispatch';

export async function handleCreateComment(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 }
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 }
    );
  }

  if (board.state === 'ARCHIVED') {
    return Response.json(
      {
        error: {
          code: 'board-is-archived',
          message: 'This board is archived and cannot be modified.',
        },
      },
      { status: 403 }
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) return roleError;

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  let body: { content?: string; idempotency_key?: string; parent_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
    return Response.json(
      { error: { code: 'bad-request', message: 'content is required' } },
      { status: 400 }
    );
  }

  // [why] Enforce max one level of threading — replies to replies are not allowed.
  let parentId: string | null = null;
  if (body.parent_id !== undefined) {
    if (typeof body.parent_id !== 'string' || body.parent_id.trim() === '') {
      return Response.json(
        { error: { code: 'bad-request', message: 'parent_id must be a non-empty string' } },
        { status: 400 }
      );
    }
    const parentComment = await db('comments').where({ id: body.parent_id.trim() }).first();
    if (!parentComment) {
      return Response.json(
        { error: { code: 'comment-not-found', message: 'Parent comment not found' } },
        { status: 404 }
      );
    }
    if (parentComment.card_id !== cardId) {
      return Response.json(
        { error: { code: 'bad-request', message: 'Parent comment does not belong to this card' } },
        { status: 400 }
      );
    }
    if (parentComment.parent_id !== null && parentComment.parent_id !== undefined) {
      return Response.json(
        { error: { name: 'reply-depth-exceeded', message: 'Replies to replies are not allowed' } },
        { status: 422 }
      );
    }
    parentId = body.parent_id.trim();
  }

  // [why] If the client provided an idempotency_key (e.g. during offline replay), check
  //        whether this user already created a comment with this key for this card.
  //        If found, return the existing comment to the client without inserting a duplicate.
  if (body.idempotency_key !== undefined) {
    if (typeof body.idempotency_key !== 'string' || body.idempotency_key.trim() === '') {
      return Response.json(
        { error: { code: 'bad-request', message: 'idempotency_key must be a non-empty string' } },
        { status: 400 }
      );
    }

    const existing = await db('comments')
      .leftJoin('users', 'comments.user_id', 'users.id')
      .where('comments.user_id', actorId)
      .where('comments.idempotency_key', body.idempotency_key.trim())
      .select(
        'comments.id',
        'comments.card_id',
        'comments.user_id',
        'comments.content',
        'comments.version',
        'comments.deleted',
        'comments.created_at',
        'comments.updated_at',
        db.raw('COALESCE(users.name, users.email) as author_name'),
        'users.email as author_email',
        'users.avatar_url as author_avatar_url'
      )
      .first();

    if (existing) {
      const authorAvatarUrl = buildAvatarProxyUrl({
        userId: actorId,
        avatarUrl: ((existing as Record<string, unknown>).author_avatar_url as string | null) ?? null,
      });
      return Response.json(
        { data: { ...existing, author_avatar_url: authorAvatarUrl } },
        { status: 201 }
      );
    }
  }

  const id = randomUUID();
  const trimmedContent = sanitizeRichText(body.content.trim());
  const idempotencyKey = body.idempotency_key?.trim() ?? null;

  await db.transaction(async (trx) => {
    await trx('comments').insert({
      id,
      card_id: cardId,
      user_id: actorId,
      content: trimmedContent,
      idempotency_key: idempotencyKey,
      parent_id: parentId,
      version: 1,
      deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const { addedUserIds } = await syncMentions({
      trx,
      sourceType: 'comment',
      sourceId: id,
      text: trimmedContent,
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
      cardTitle: card.title,
      boardName: board.title,
    });
  });

  const comment = await db('comments')
    .leftJoin('users', 'comments.user_id', 'users.id')
    .where('comments.id', id)
    .select(
      'comments.id',
      'comments.card_id',
      'comments.user_id',
      'comments.content',
      'comments.version',
      'comments.deleted',
      'comments.parent_id',
      'comments.created_at',
      'comments.updated_at',
      db.raw('COALESCE(users.name, users.email) as author_name'),
      'users.email as author_email',
      'users.avatar_url as author_avatar_url'
    )
    .first();

  const authorAvatarUrl = buildAvatarProxyUrl({
    userId: actorId,
    avatarUrl: ((comment as Record<string, unknown>).author_avatar_url as string | null) ?? null,
  });
  const commentData = { ...comment, author_avatar_url: authorAvatarUrl };

  // commentPreview strips HTML tags and truncates to 120 chars.
  const rawPreview = trimmedContent.replace(/<[^>]+>/g, '');
  const commentPreview = rawPreview.length > 120 ? rawPreview.slice(0, 117) + '…' : rawPreview;

  await Promise.all([
    dispatchEvent({
      type: 'comment_added',
      boardId: board.id,
      entityId: cardId,
      actorId,
      payload: { commentId: id, cardId, cardTitle: card.title },
    }),
    writeActivity({
      entityType: 'card',
      entityId: cardId,
      boardId: board.id,
      action: 'comment_added',
      actorId,
      payload: { commentId: id, cardId, cardTitle: card.title, commentPreview },
    }),
  ]);

  // [why] Emit different WS events for top-level comments vs replies so clients can handle each case.
  if (parentId) {
    publisher
      .publish(
        board.id,
        JSON.stringify({
          type: 'comment_reply_added',
          payload: { card_id: cardId, parent_comment_id: parentId, reply: commentData },
        }),
      )
      .catch(() => {});
  } else {
    publisher
      .publish(board.id, JSON.stringify({ type: 'comment_added', payload: { comment: commentData } }))
      .catch(() => {});
  }

  // Fire-and-forget card_commented notification for all board members (except commenter).
  dispatchDirectCardNotification({
    payload: { type: 'card_commented', cardTitle: card.title, commentPreview, commentId: id },
    boardId: board.id,
    cardId,
    actorId,
  }).catch(() => {});

  return Response.json({ data: commentData }, { status: 201 });
}
