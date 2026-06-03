// Sprint 166 — raw message persistence with best-effort embedding side path.
import { randomUUID } from 'crypto';
import { db } from '../../../../../common/db';
import type {
  BoardChatMessage,
  BoardChatThread,
  BoardChatMessageVector,
  WriteBoardChatMessageInput,
  WriteBoardChatMessageResult,
} from '../../../types';
import { generateBoardChatEmbedding, persistBoardChatMessageVector } from './embedding';
import { enqueueBoardChatEmbeddingRetry } from './retry';

export const boardChatWriteDeps = {
  db,
  generateBoardChatEmbedding,
  persistBoardChatMessageVector,
  enqueueBoardChatEmbeddingRetry,
};

async function ensureBoardChatThread({
  boardId,
  now,
}: {
  boardId: string;
  now: string;
}): Promise<BoardChatThread> {
  const existing = (await boardChatWriteDeps.db('board_chat_threads').where({ board_id: boardId }).first()) as
    | BoardChatThread
    | undefined;
  if (existing) return existing;

  const threadId = randomUUID();
  await boardChatWriteDeps.db('board_chat_threads').insert({
    id: threadId,
    board_id: boardId,
    created_at: now,
    updated_at: now,
    last_message_at: null,
  });

  return {
    id: threadId,
    board_id: boardId,
    created_at: now,
    updated_at: now,
    last_message_at: null,
  };
}

async function markThreadActivity({
  threadId,
  now,
}: {
  threadId: string;
  now: string;
}): Promise<void> {
  await boardChatWriteDeps.db('board_chat_threads').where({ id: threadId }).update({
    last_message_at: now,
    updated_at: now,
  });
}

export async function writeBoardChatMessage({
  boardId,
  authorId,
  content,
}: WriteBoardChatMessageInput): Promise<WriteBoardChatMessageResult> {
  const now = new Date().toISOString();
  const normalizedContent = content.trim();
  if (normalizedContent === '') {
    throw new Error('missing-board-chat-content');
  }

  const thread = await ensureBoardChatThread({ boardId, now });
  const messageId = randomUUID();
  const message: BoardChatMessage = {
    id: messageId,
    thread_id: thread.id,
    board_id: boardId,
    author_id: authorId,
    content: normalizedContent,
    created_at: now,
    updated_at: now,
  };

  await boardChatWriteDeps.db('board_chat_messages').insert(message);
  await markThreadActivity({ threadId: thread.id, now });
  const persistedThread: BoardChatThread = {
    ...thread,
    last_message_at: now,
    updated_at: now,
  };

  let vector: BoardChatMessageVector | null = null;
  let queuedForEmbeddingRetry = false;

  try {
    const embedding = await boardChatWriteDeps.generateBoardChatEmbedding({ text: normalizedContent });
    vector = await boardChatWriteDeps.persistBoardChatMessageVector({
      messageId,
      boardId,
      embedding,
    });
  } catch (error) {
    queuedForEmbeddingRetry = true;
    void boardChatWriteDeps.enqueueBoardChatEmbeddingRetry({
      messageId,
      boardId,
      reason: error instanceof Error ? error.message : 'board-chat-embedding-failed',
    }).catch(() => {
      // TODO: surface retry-queue delivery failures through the chat ops logger.
    });
  }

  return {
    status: 201,
    data: {
      thread: persistedThread,
      message,
      vector,
      queuedForEmbeddingRetry,
    },
  };
}
