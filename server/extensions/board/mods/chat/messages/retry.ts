// Sprint 166 — retry queue helpers for board chat embeddings.
import { db } from '../../../../../common/db';
import { pubsub } from '../../../../../mods/pubsub/index';
import type { BoardChatMessage } from '../../../types';
import { generateBoardChatEmbedding, persistBoardChatMessageVector } from './embedding';

export const boardChatRetryDeps = {
  db,
  pubsub,
  generateBoardChatEmbedding,
  persistBoardChatMessageVector,
};

const RETRY_QUEUE_KEY = 'board_chat_embedding_retry';

export interface BoardChatEmbeddingRetryPayload {
  messageId: string;
  boardId: string;
  reason?: string;
}

export async function enqueueBoardChatEmbeddingRetry(
  payload: BoardChatEmbeddingRetryPayload,
): Promise<void> {
  await boardChatRetryDeps.pubsub.publish(RETRY_QUEUE_KEY, JSON.stringify(payload));
}

export async function retryBoardChatEmbedding({
  messageId,
  boardId,
}: {
  messageId: string;
  boardId: string;
}): Promise<void> {
  const message = (await boardChatRetryDeps.db('board_chat_messages')
    .where({ id: messageId, board_id: boardId })
    .first()) as BoardChatMessage | undefined;

  if (!message) {
    throw new Error('board-chat-message-not-found');
  }

  const existingVector = await boardChatRetryDeps.db('board_chat_message_vectors')
    .where({ message_id: messageId, board_id: boardId })
    .first();

  if (existingVector) {
    return;
  }

  const embedding = await boardChatRetryDeps.generateBoardChatEmbedding({ text: message.content });
  await boardChatRetryDeps.persistBoardChatMessageVector({
    messageId,
    boardId,
    embedding,
  });
}
