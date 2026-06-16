// Sprint 166 — raw message persistence with best-effort embedding side path.
// Sprint 199 — session-scoped messages: sessionId is required; auto-thread
// creation is replaced by explicit session creation via /chat/sessions.
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

// [why] Validates that a session exists and belongs to this board.
// No auto-creation — the user must explicitly create a session first.
async function resolveBoardChatThread({
  sessionId,
  boardId,
}: {
  sessionId: string;
  boardId: string;
}): Promise<BoardChatThread> {
  const thread = (await boardChatWriteDeps
    .db('board_chat_threads')
    .where({ id: sessionId, board_id: boardId })
    .first()) as BoardChatThread | undefined;

  if (!thread) {
    throw Object.assign(
      new Error('board-chat-session-not-found'),
      { code: 'board-chat-session-not-found', status: 404 },
    );
  }

  return thread;
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
  sessionId,
  authorId,
  content,
  isAssistant = false,
}: WriteBoardChatMessageInput): Promise<WriteBoardChatMessageResult> {
  const now = new Date().toISOString();
  const normalizedContent = content.trim();
  if (normalizedContent === '') {
    throw new Error('missing-board-chat-content');
  }

  const thread = await resolveBoardChatThread({ sessionId, boardId });
  const messageId = randomUUID();
  const message: BoardChatMessage = {
    id: messageId,
    thread_id: thread.id,
    board_id: boardId,
    author_id: authorId ?? null,
    content: normalizedContent,
    is_assistant: isAssistant,
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
