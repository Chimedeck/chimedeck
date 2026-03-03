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

export async function handleCreateComment(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const card = await db('cards').where({ id: cardId }).first();
  if (!card) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  const list = await db('lists').where({ id: card.list_id }).first();
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
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
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'content is required' } },
      { status: 400 },
    );
  }

  const id = randomUUID();
  await db('comments').insert({
    id,
    card_id: cardId,
    user_id: actorId,
    content: body.content.trim(),
    version: 1,
    deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
