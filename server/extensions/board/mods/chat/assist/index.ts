import { db } from '../../../../../common/db';
import type {
  BoardChatAssistInput,
  BoardChatAssistMessage,
  BoardChatAssistOutput,
  BoardChatAssistToolCall,
} from '../../../types';
import { CREATE_BOARD_CARD_TOOL, createBoardCard } from './createBoardCard';
import { requestBoardChatAssistCompletion } from './provider';

const DEFAULT_CONTEXT_LIMIT = 12;
const MAX_CONTEXT_LIMIT = 50;

interface ContextMessageRow {
  content: string;
  author_name: string | null;
}

function normalizeContextLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CONTEXT_LIMIT;
  return Math.min(Math.max(Math.floor(value), 1), MAX_CONTEXT_LIMIT);
}

function buildAssistMessages({
  prompt,
  contextRows,
}: {
  prompt: string;
  contextRows: ContextMessageRow[];
}): BoardChatAssistMessage[] {
  const messages: BoardChatAssistMessage[] = [
    {
      role: 'system',
      content:
        'You are an assistant for board collaboration chat. Be concise, actionable, and grounded in the provided board chat context.',
    },
    {
      role: 'system',
      content:
        'If the user wants a card created, call the create_board_card tool instead of replying with a manual checklist.',
    },
  ];

  if (contextRows.length > 0) {
    const contextLines = contextRows.map((row) => {
      const authorName = row.author_name?.trim() || 'Unknown user';
      return `- ${authorName}: ${row.content}`;
    });
    messages.push({
      role: 'system',
      content: `Recent board chat context:\n${contextLines.join('\n')}`,
    });
  }

  messages.push({
    role: 'user',
    content: prompt,
  });
  return messages;
}

export const boardChatAssistDeps = {
  fetchRecentBoardMessages: async ({
    boardId,
    limit,
  }: {
    boardId: string;
    limit: number;
  }): Promise<ContextMessageRow[]> => {
    const rows = await db('board_chat_messages as m')
      .leftJoin('users as u', 'm.author_id', 'u.id')
      .where('m.board_id', boardId)
      .orderBy('m.created_at', 'desc')
      .limit(limit)
      .select(
        'm.content',
        db.raw('COALESCE(u.name, u.email) as author_name'),
      );
    return (rows as ContextMessageRow[]).reverse();
  },
  requestBoardChatAssistCompletion,
  createBoardCard,
};

function hasToolCalls(data: BoardChatAssistOutput['data']): data is NonNullable<BoardChatAssistOutput['data']> & {
  toolCalls: BoardChatAssistToolCall[];
} {
  return Array.isArray(data?.toolCalls) && data.toolCalls.length > 0;
}

export async function assistBoardChat({
  boardId,
  prompt,
  contextLimit,
  request,
  actorId,
  board,
}: BoardChatAssistInput & {
  request: Request;
  actorId: string;
  board: { id: string; workspace_id: string; title: string; state: string };
}): Promise<BoardChatAssistOutput> {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt === '') {
    return {
      status: 400,
      name: 'missing-prompt',
      message: 'prompt is required',
    };
  }

  const recentMessages = await boardChatAssistDeps.fetchRecentBoardMessages({
    boardId,
    limit: normalizeContextLimit(contextLimit),
  });
  const messages = buildAssistMessages({
    prompt: normalizedPrompt,
    contextRows: recentMessages,
  });

  const completion = await boardChatAssistDeps.requestBoardChatAssistCompletion({
    messages,
    tools: [CREATE_BOARD_CARD_TOOL],
  });

  if (completion.status !== 200 || !completion.data) {
    return completion;
  }

  if (!hasToolCalls(completion.data)) {
    return completion;
  }

  const [toolCall] = completion.data.toolCalls;
  if (!toolCall || toolCall.function.name !== 'create_board_card') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'Assistant returned an unsupported tool call',
    };
  }

  const createBoardCardInput = {
    request,
    board,
    actorId,
    toolCall,
    model: completion.data.model,
  } as Parameters<typeof boardChatAssistDeps.createBoardCard>[0];
  if (completion.data.usage) {
    createBoardCardInput.usage = completion.data.usage;
  }

  return boardChatAssistDeps.createBoardCard(createBoardCardInput);
}
