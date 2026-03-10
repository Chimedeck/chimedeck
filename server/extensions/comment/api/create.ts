// POST /api/v1/cards/:id/comments — add a comment; min role: MEMBER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { writeEvent } from '../../../mods/events/write';
import { writeActivity } from '../../activity/mods/write';
import { publisher } from '../../../mods/pubsub/publisher';
import { syncMentions } from '../../../common/mentions/sync';
import { createNotificationsForMentions } from '../../notifications/mods/createNotifications';

export async function handleCreateComment(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  if (board.state === 'ARCHIVED') {
    return Response.json(
      { error: { code: 'board-is-archived', message: 'This board is archived and cannot be modified.' } },
      { status: 403 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  let body: { content?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
    return Response.json(
      { error: { code: 'bad-request', message: 'content is required' } },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const trimmedContent = body.content.trim();

  await db.transaction(async (trx) => {
    await trx('comments').insert({
      id,
      card_id: cardId,
      user_id: actorId,
      content: trimmedContent,
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
      'comments.created_at',
      'comments.updated_at',
      db.raw("COALESCE(users.name, users.email) as author_name"),
      'users.email as author_email',
    )
    .first();

  await Promise.all([
    writeEvent({
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
      payload: { commentId: id, cardId, cardTitle: card.title },
    }),
  ]);

  // Broadcast WS event to board subscribers
  publisher.publish(
    board.id,
    JSON.stringify({ type: 'comment_added', payload: { comment } }),
  ).catch(() => {});

  return Response.json({ data: comment }, { status: 201 });
}
