import { db } from '../../../../../common/db';
import { buildAvatarProxyUrl } from '../../../../../common/avatar/resolveAvatarUrl';
import { generateBoardChatEmbedding } from '../messages/embedding';
import type {
  BoardChatSearchHit,
  SearchBoardChatMessagesInput,
  SearchBoardChatMessagesOutput,
} from '../../../types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;

interface BoardChatMessageVectorRow {
  message_id: string;
  embedding: unknown;
}

interface BoardChatMessageAuthorRow {
  id: string;
  thread_id: string;
  board_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  author_avatar_url: string | null;
}

function normalizeEmbedding(input: unknown): number[] | null {
  let parsed: unknown;
  try {
    parsed = typeof input === 'string' ? JSON.parse(input) : input;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const values = parsed
    .map((value) => (typeof value === 'number' ? value : Number(value)))
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? values : null;
}

function cosineSimilarity(left: number[], right: number[]): number {
  const dims = Math.min(left.length, right.length);
  if (dims === 0) return 0;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < dims; index += 1) {
    const leftValue = left[index]!;
    const rightValue = right[index]!;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  if (denominator === 0) return 0;
  return dot / denominator;
}

export const boardChatSearchDeps = {
  generateBoardChatEmbedding,
  fetchBoardMessageVectors: async ({
    boardId,
  }: {
    boardId: string;
  }): Promise<BoardChatMessageVectorRow[]> => {
    const rows = await db('board_chat_message_vectors')
      .where({ board_id: boardId })
      .select('message_id', 'embedding');
    return rows as BoardChatMessageVectorRow[];
  },
  fetchBoardMessagesByIds: async ({
    boardId,
    messageIds,
  }: {
    boardId: string;
    messageIds: string[];
  }): Promise<BoardChatMessageAuthorRow[]> => {
    if (messageIds.length === 0) return [];
    const rows = await db('board_chat_messages as m')
      .leftJoin('users as u', 'm.author_id', 'u.id')
      .where('m.board_id', boardId)
      .whereIn('m.id', messageIds)
      .select(
        'm.id',
        'm.thread_id',
        'm.board_id',
        'm.author_id',
        'm.content',
        'm.created_at',
        'm.updated_at',
        db.raw('COALESCE(u.name, u.email) as author_name'),
        'u.avatar_url as author_avatar_url'
      );
    return rows as BoardChatMessageAuthorRow[];
  },
};

export async function searchBoardChatMessages({
  boardId,
  query,
  limit: rawLimit,
}: SearchBoardChatMessagesInput): Promise<SearchBoardChatMessagesOutput> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < MIN_QUERY_LENGTH) {
    return {
      status: 400,
      name: 'search-query-too-short',
      message: `query must be at least ${MIN_QUERY_LENGTH} characters`,
    };
  }

  const requestedLimit =
    typeof rawLimit === 'number' && Number.isFinite(rawLimit)
      ? Math.floor(rawLimit)
      : DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const queryEmbedding = await boardChatSearchDeps.generateBoardChatEmbedding({
    text: normalizedQuery,
  });
  const queryVector = queryEmbedding.values;
  if (queryVector.length === 0) {
    return {
      status: 502,
      name: 'chat-embedding-response-invalid',
      message: 'Embedding provider returned an empty query vector',
    };
  }

  const vectorRows = await boardChatSearchDeps.fetchBoardMessageVectors({ boardId });
  if (vectorRows.length === 0) {
    return { status: 200, data: [] };
  }

  const scoredVectors = vectorRows
    .map((row) => {
      const values = normalizeEmbedding(row.embedding);
      if (!values) return null;
      return {
        messageId: row.message_id,
        score: cosineSimilarity(values, queryVector),
      };
    })
    .filter((item): item is { messageId: string; score: number } => item !== null);

  if (scoredVectors.length === 0) {
    return { status: 200, data: [] };
  }

  const messageRows = await boardChatSearchDeps.fetchBoardMessagesByIds({
    boardId,
    messageIds: scoredVectors.map((item) => item.messageId),
  });
  const messageById = new Map(messageRows.map((row) => [row.id, row]));

  const hits: BoardChatSearchHit[] = scoredVectors
    .map((item) => {
      const row = messageById.get(item.messageId);
      if (!row) return null;
      return {
        id: row.id,
        thread_id: row.thread_id,
        board_id: row.board_id,
        author_id: row.author_id,
        content: row.content,
        created_at: row.created_at,
        updated_at: row.updated_at,
        userName: row.author_name,
        avatar: buildAvatarProxyUrl({
          userId: row.author_id,
          avatarUrl: row.author_avatar_url,
        }),
        score: item.score,
      };
    })
    .filter((item): item is BoardChatSearchHit => item !== null);

  hits.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.created_at !== left.created_at)
      return right.created_at.localeCompare(left.created_at);
    return right.id.localeCompare(left.id);
  });

  return {
    status: 200,
    data: hits.slice(0, limit),
  };
}
