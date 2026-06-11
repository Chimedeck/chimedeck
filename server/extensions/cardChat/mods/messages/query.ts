// Sprint 171 — cursor-paginated retrieval of card-chat messages.
import { db } from '../../../../common/db';
import type { GetCardChatMessagesInput, GetCardChatMessagesResult } from '../../types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function getCardChatMessages({
  cardId,
  cursor,
  limit,
}: GetCardChatMessagesInput): Promise<GetCardChatMessagesResult> {
  const effectiveLimit = Math.min(
    Number.isNaN(limit) || !limit || limit < 1 ? DEFAULT_LIMIT : limit,
    MAX_LIMIT,
  );

  // Find the session for this card
  const session = await db('card_chat_sessions')
    .where({ card_id: cardId })
    .orderBy('created_at', 'desc')
    .first();

  if (!session) {
    return {
      data: [],
      metadata: { cursor: null, hasMore: false },
    };
  }

  let query = db('card_chat_messages as m')
    .leftJoin('users as u', 'm.author_id', 'u.id')
    .where('m.session_id', session.id)
    .orderBy('m.created_at', 'asc')
    .orderBy('m.id', 'asc')
    .limit(effectiveLimit + 1)
    .select(
      'm.id',
      'm.session_id',
      'm.role',
      'm.content',
      'm.metadata',
      'm.author_id',
      'm.created_at',
      'm.updated_at',
      db.raw('COALESCE(u.name, u.email) as author_name'),
      'u.avatar_url as author_avatar_url',
    );

  if (cursor) {
    const cursorRow = await db('card_chat_messages').where({ id: cursor }).first();
    if (cursorRow) {
      query = query.where(function () {
        this.where('m.created_at', '>', cursorRow.created_at).orWhere(function () {
          this.where('m.created_at', '=', cursorRow.created_at).andWhere('m.id', '>', cursor);
        });
      });
    }
  }

  const rows = await query;
  const hasMore = rows.length > effectiveLimit;
  const data = (hasMore ? rows.slice(0, effectiveLimit) : rows).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata,
    author_id: row.author_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    authorName: row.author_name ?? null,
    avatar: row.author_avatar_url ?? null,
  }));

  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.id : null;

  return {
    data,
    metadata: {
      cursor: nextCursor,
      hasMore,
    },
  };
}
