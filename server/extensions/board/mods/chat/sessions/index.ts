// Board chat session management — create, list, switch sessions.
// [why] Multiple sessions per board keep chat context bounded, preventing token overload
// and allowing users to switch topics without carrying forward irrelevant history.
import { randomUUID } from 'crypto';
import { db } from '../../../../../common/db';
import type { BoardChatThread } from '../../../types';

export interface CreateSessionInput {
  boardId: string;
  createdBy: string;
  name?: string;
}

export interface CreateSessionResult {
  status: 201;
  data: BoardChatThread;
}

export interface ListSessionsInput {
  boardId: string;
}

export interface ListSessionsResult {
  status: 200;
  data: BoardChatThread[];
}

export interface GetSessionInput {
  sessionId: string;
  boardId: string;
}

export interface GetSessionResult {
  status: 200;
  data: BoardChatThread;
}

export interface UpdateSessionInput {
  sessionId: string;
  boardId: string;
  name?: string;
}

export interface UpdateSessionResult {
  status: 200;
  data: BoardChatThread;
}

export const boardChatSessionDeps = {
  db,
};

export async function createBoardChatSession({
  boardId,
  createdBy,
  name,
}: CreateSessionInput): Promise<CreateSessionResult> {
  const now = new Date().toISOString();
  const sessionId = randomUUID();
  const thread: BoardChatThread = {
    id: sessionId,
    board_id: boardId,
    name: name?.trim() || null,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
    last_message_at: null,
  };

  await boardChatSessionDeps.db('board_chat_threads').insert(thread);

  return { status: 201, data: thread };
}

export async function listBoardChatSessions({
  boardId,
}: ListSessionsInput): Promise<ListSessionsResult> {
  const threads = (await boardChatSessionDeps
    .db('board_chat_threads')
    .where({ board_id: boardId })
    .orderBy('last_message_at', 'desc')
    .orderBy('created_at', 'desc')
    .limit(50)) as BoardChatThread[];

  return { status: 200, data: threads };
}

export async function getBoardChatSession({
  sessionId,
  boardId,
}: GetSessionInput): Promise<GetSessionResult> {
  const thread = (await boardChatSessionDeps
    .db('board_chat_threads')
    .where({ id: sessionId, board_id: boardId })
    .first()) as BoardChatThread | undefined;

  if (!thread) {
    throw Object.assign(new Error('session-not-found'), {
      status: 404,
      code: 'session-not-found',
    });
  }

  return { status: 200, data: thread };
}

export async function updateBoardChatSession({
  sessionId,
  boardId,
  name,
}: UpdateSessionInput): Promise<UpdateSessionResult> {
  const thread = (await boardChatSessionDeps
    .db('board_chat_threads')
    .where({ id: sessionId, board_id: boardId })
    .first()) as BoardChatThread | undefined;

  if (!thread) {
    throw Object.assign(new Error('session-not-found'), {
      status: 404,
      code: 'session-not-found',
    });
  }

  const now = new Date().toISOString();
  const updatedName = name?.trim() || null;

  await boardChatSessionDeps
    .db('board_chat_threads')
    .where({ id: sessionId })
    .update({ name: updatedName, updated_at: now });

  return {
    status: 200,
    data: {
      ...thread,
      name: updatedName,
      updated_at: now,
    },
  };
}
