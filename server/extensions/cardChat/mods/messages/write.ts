// Sprint 171 — persist card-chat messages and update session activity timestamp.
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import type {
  CardChatMessage,
  WriteCardChatMessageInput,
  WriteCardChatMessageResult,
} from '../../types';

export const cardChatWriteDeps = { db };

/**
 * Write a message to a card-chat session.
 * Rejects writes when the session is PAUSED or READY_FOR_REVIEW.
 */
export async function writeCardChatMessage({
  sessionId,
  cardId,
  authorId,
  role,
  content,
}: WriteCardChatMessageInput): Promise<WriteCardChatMessageResult> {
  const normalizedContent = content.trim();
  if (normalizedContent === '') {
    throw new Error('missing-card-chat-content');
  }

  // Validate session exists and is in a writeable state
  const session = await cardChatWriteDeps
    .db('card_chat_sessions')
    .where({ id: sessionId, card_id: cardId })
    .first();

  if (!session) {
    throw new Error('card-chat-session-not-found');
  }

  if (session.status !== 'ACTIVE_REFINEMENT') {
    throw new Error('card-chat-session-not-active');
  }

  const now = new Date().toISOString();
  const messageId = randomUUID();

  const message: CardChatMessage = {
    id: messageId,
    session_id: sessionId,
    role,
    content: normalizedContent,
    metadata: null,
    author_id: authorId,
    created_at: now,
    updated_at: now,
  };

  await cardChatWriteDeps.db('card_chat_messages').insert(message);

  // Bump last_actor_at on the session
  await cardChatWriteDeps
    .db('card_chat_sessions')
    .where({ id: sessionId })
    .update({ last_actor_at: now, updated_at: now });

  return {
    status: 201,
    data: { message },
  };
}
