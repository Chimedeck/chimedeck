import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import { serializeReaction } from '../../serializers/reaction';

type ReactionRow = {
  id?: string | null;
  comment_id: string;
  user_id: string;
  emoji: string;
};

export type TrelloAuthUser = {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
};

export async function listActionReactionRows(commentId: string): Promise<ReactionRow[]> {
  return await db('comment_reactions')
    .where({ comment_id: commentId })
    .orderBy('created_at', 'asc') as ReactionRow[];
}

export async function listActionReactions(commentId: string) {
  const rows = await listActionReactionRows(commentId);
  return rows.map((row) => serializeReaction({
    id: row.id ?? null,
    idMember: row.user_id,
    idModel: commentId,
    emoji: row.emoji,
  }));
}

export async function getActionReaction(commentId: string, reactionIdentifier: string) {
  const byId = await db('comment_reactions')
    .where({ id: reactionIdentifier, comment_id: commentId })
    .first() as ReactionRow | undefined;
  if (byId) {
    return serializeReaction({
      id: byId.id ?? null,
      idMember: byId.user_id,
      idModel: commentId,
      emoji: byId.emoji,
    });
  }

  const byEmoji = await db('comment_reactions')
    .where({ comment_id: commentId, emoji: reactionIdentifier })
    .first() as ReactionRow | undefined;
  if (!byEmoji) return null;

  return serializeReaction({
    id: byEmoji.id ?? null,
    idMember: byEmoji.user_id,
    idModel: commentId,
    emoji: byEmoji.emoji,
  });
}

export async function createOrGetActionReaction(args: {
  commentId: string;
  emoji: string;
  user: TrelloAuthUser;
}) {
  const existing = await db('comment_reactions')
    .where({ comment_id: args.commentId, user_id: args.user.id, emoji: args.emoji })
    .first() as ReactionRow | undefined;

  if (!existing) {
    await db('comment_reactions').insert({
      id: randomUUID(),
      comment_id: args.commentId,
      user_id: args.user.id,
      emoji: args.emoji,
      created_at: new Date().toISOString(),
    });
  }

  const created = await db('comment_reactions')
    .where({ comment_id: args.commentId, user_id: args.user.id, emoji: args.emoji })
    .first() as ReactionRow | undefined;

  return serializeReaction({
    id: created?.id ?? null,
    idMember: args.user.id,
    idModel: args.commentId,
    emoji: args.emoji,
  });
}

export async function deleteActionReaction(args: {
  commentId: string;
  reactionIdentifier: string;
  callerId: string;
  boardAdmin: boolean;
}): Promise<{ allowed: boolean }> {
  const byId = await db('comment_reactions')
    .where({ id: args.reactionIdentifier, comment_id: args.commentId })
    .first() as ReactionRow | undefined;

  if (byId) {
    if (byId.user_id !== args.callerId && !args.boardAdmin) {
      return { allowed: false };
    }
    await db('comment_reactions').where({ id: byId.id }).delete();
    return { allowed: true };
  }

  await db('comment_reactions')
    .where({ comment_id: args.commentId, user_id: args.callerId, emoji: args.reactionIdentifier })
    .delete();
  return { allowed: true };
}
