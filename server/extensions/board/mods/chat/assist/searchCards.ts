import { queryBoardSearch } from '../../../../search/mods/queryBoardSearch';
import type {
  BoardChatAssistOutput,
  BoardChatAssistToolCall,
  BoardChatAssistToolDefinition,
} from '../../../types';

export const SEARCH_CARDS_TOOL: BoardChatAssistToolDefinition = {
  type: 'function',
  function: {
    name: 'search_cards',
    description:
      'Search for cards on the current board by keyword. Returns matching card titles, IDs, and their parent list IDs. Use this to help the user find relevant cards before creating new ones or to answer questions about existing work.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords (minimum 2 characters). Matches against card titles and descriptions.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

interface SearchCardsArguments {
  query: string;
}

interface SearchCardsInput {
  boardId: string;
  toolCall: BoardChatAssistToolCall;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function normalizeSearchArguments(rawArguments: string): SearchCardsArguments | BoardChatAssistOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'search_cards arguments must be valid JSON',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'search_cards arguments must be an object',
    };
  }

  const candidate = parsed as Record<string, unknown>;

  if (typeof candidate.query !== 'string' || candidate.query.trim() === '') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'search_cards.query must be a non-empty string',
    };
  }

  return {
    query: candidate.query.trim(),
  };
}

export const searchCardsDeps = {
  queryBoardSearch,
};

export async function searchCards(input: SearchCardsInput): Promise<BoardChatAssistOutput> {
  const normalized = normalizeSearchArguments(input.toolCall.function.arguments);
  if ('status' in normalized) return normalized;

  const searchResult = await searchCardsDeps.queryBoardSearch({
    boardId: input.boardId,
    q: normalized.query,
  });

  if (searchResult.status !== 200 || !searchResult.data) {
    return {
      status: searchResult.status,
      name: searchResult.name ?? 'search-cards-failed',
      message: searchResult.message ?? 'Card search failed',
    };
  }

  const cards = searchResult.data.filter((hit) => hit.type === 'card');
  const resultsText = cards.length > 0
    ? cards
      .map((c) => `- "${c.title}" (card ID: ${c.id}, list ID: ${c.listId ?? 'unknown'})`)
      .join('\n')
    : 'No matching cards found on this board.';

  return {
    status: 200,
    data: {
      model: input.model,
      message: `Card search results for "${normalized.query}":\n${resultsText}`,
      ...(input.usage ? { usage: input.usage } : {}),
      toolCalls: [input.toolCall],
    },
  };
}
