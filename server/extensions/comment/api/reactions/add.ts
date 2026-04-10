// POST /api/v1/comments/:commentId/reactions — add an emoji reaction (idempotent).
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { publisher } from '../../../../mods/pubsub/publisher';

export async function handleAddReaction(req: Request, commentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const comment = await db('comments').where({ id: commentId }).first();
  if (!comment) {
    return Response.json(
      { error: { code: 'comment-not-found', message: 'Comment not found' } },
      { status: 404 },
    );
  }

  const card = await db('cards').where({ id: comment.card_id }).first();
  const list = card ? await db('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const membershipError = await requireWorkspaceMembership(
    req as WorkspaceScopedRequest,
    board.workspace_id,
  );
  if (membershipError) return membershipError;

  let body: { emoji?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (
    !body.emoji ||
    typeof body.emoji !== 'string' ||
    body.emoji.trim() === '' ||
    body.emoji.trim().length > 32
  ) {
    return Response.json(
      { error: { code: 'reaction-emoji-invalid', message: 'emoji must be a non-empty string of ≤ 32 characters' } },
      { status: 400 },
    );
  }

  const emoji = body.emoji.trim();
  const actorId = (req as AuthenticatedRequest).currentUser!.id;

  // Idempotent upsert — ignore conflict on the unique (comment_id, user_id, emoji) key.
  await db('comment_reactions')
    .insert({ comment_id: commentId, user_id: actorId, emoji })
    .onConflict(['comment_id', 'user_id', 'emoji'])
    .ignore();

  publisher
    .publish(
      board.id,
      JSON.stringify({
        type: 'comment_reaction_added',
        payload: { card_id: comment.card_id, comment_id: commentId, emoji, user_id: actorId },
      }),
    )
    .catch(() => {});

  return Response.json({ data: { comment_id: commentId, emoji, user_id: actorId } });
}
