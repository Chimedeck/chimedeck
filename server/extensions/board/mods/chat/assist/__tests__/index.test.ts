import { beforeEach, describe, expect, it } from 'bun:test';
import type { BoardChatAssistOutput } from '../../../../types';

// [why] Stateful mock for the multi-turn loop. Each test sets up a queue of
// responses to simulate LLM iterations (tool calls → tool calls → plain text).
let completionQueue: BoardChatAssistOutput[];
let completionCalls: Array<{ messages: unknown[]; tools?: unknown[] }> = [];
let createBoardCardCalls: Array<unknown> = [];
let recentMessagesCalls: Array<{ boardId: string; limit: number }> = [];
let writeMessageCalls: Array<{
  boardId: string;
  sessionId: string;
  authorId: string | null;
  content: string;
  isAssistant: boolean;
}> = [];

const assistModule = await import('../index');
const { assistBoardChat, boardChatAssistDeps } = assistModule;

beforeEach(() => {
  completionQueue = [
    {
      status: 200,
      data: {
        model: 'gpt-test',
        message: 'Plain text reply',
      },
    },
  ];
  completionCalls = [];
  createBoardCardCalls = [];
  recentMessagesCalls = [];
  writeMessageCalls = [];

  boardChatAssistDeps.fetchRecentBoardMessages = async ({ boardId, limit }) => {
    recentMessagesCalls.push({ boardId, limit });
    return [];
  };
  boardChatAssistDeps.requestBoardChatAssistCompletion = async (input) => {
    completionCalls.push(input);
    const next = completionQueue.shift();
    if (!next) {
      return {
        status: 200,
        data: { model: 'gpt-test', message: 'Done.' },
      };
    }
    return next;
  };
  boardChatAssistDeps.createBoardCard = async (input) => {
    createBoardCardCalls.push(input);
    return {
      status: 200,
      data: {
        model: 'gpt-test',
        message: 'Created card "Plan launch" in Backlog.',
        actionCard: {
          state: 'confirmed',
          toolName: 'create_board_card',
          toolCallId: 'call-1',
          idempotencyKey: 'idem-1',
          source: 'board-chat-assist',
          boardId: 'board-1',
          workspaceId: 'workspace-1',
          cardId: 'card-1',
          cardTitle: 'Plan launch',
          listId: 'list-1',
          listName: 'Backlog',
        },
      },
    };
  };
  boardChatAssistDeps.searchCards = async () => ({
    status: 200,
    data: { model: 'gpt-test', message: 'No cards found.' },
  });
  boardChatAssistDeps.dispatchEvent = async () => ({
    id: 'evt-1',
    type: 'test',
    board_id: null,
    entity_id: 'entity-1',
    actor_id: 'user-1',
    payload: {},
    sequence: 1n,
    created_at: new Date(),
  });
  boardChatAssistDeps.writeBoardChatMessage = async (input) => {
    writeMessageCalls.push(input);
    return {
      status: 201,
      data: {
        thread: {
          id: 'thread-1',
          board_id: input.boardId,
          created_at: '',
          updated_at: '',
          last_message_at: '',
        },
        message: {
          id: 'msg-ai-1',
          thread_id: 'thread-1',
          board_id: input.boardId,
          author_id: input.authorId ?? null,
          content: input.content,
          is_assistant: input.isAssistant ?? false,
          created_at: '',
          updated_at: '',
        },
        vector: null,
        queuedForEmbeddingRetry: false,
      },
    };
  };
});

describe('assistBoardChat', () => {
  it('returns the plain assistant response when no tool call is requested', async () => {
    const result = await assistBoardChat({
      boardId: 'board-1',
      sessionId: 'thread-1',
      prompt: 'What should we do next?',
      contextLimit: 3,
      request: new Request('http://localhost'),
      actorId: 'user-1',
      board: { id: 'board-1', workspace_id: 'workspace-1', title: 'Board', state: 'ACTIVE' },
    });

    expect(result.status).toBe(200);
    expect(result.data?.message).toBe('Plain text reply');
    expect(completionCalls).toHaveLength(1);
    expect(completionCalls[0]?.tools).toHaveLength(6);
    expect(createBoardCardCalls).toHaveLength(0);
    expect(recentMessagesCalls).toEqual([{ boardId: 'board-1', limit: 3 }]);
    // [why] AI response is now persisted as a chat message with isAssistant flag
    expect(writeMessageCalls).toEqual([
      {
        boardId: 'board-1',
        sessionId: 'thread-1',
        authorId: null,
        content: 'Plain text reply',
        isAssistant: true,
      },
    ]);
  });

  it('executes create_board_card tool calls and returns action metadata', async () => {
    // [why] First iteration: LLM calls create_board_card, second: confirms in natural language
    completionQueue = [
      {
        status: 200,
        data: {
          model: 'gpt-test',
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: {
                name: 'create_board_card',
                arguments: JSON.stringify({
                  title: 'Plan launch',
                  listId: 'list-1',
                }),
              },
            },
          ],
        },
      },
      {
        status: 200,
        data: { model: 'gpt-test', message: 'Card created.' },
      },
    ];

    const result = await assistBoardChat({
      boardId: 'board-1',
      sessionId: 'thread-1',
      prompt: 'Create a planning card',
      request: new Request('http://localhost'),
      actorId: 'user-1',
      board: { id: 'board-1', workspace_id: 'workspace-1', title: 'Board', state: 'ACTIVE' },
    });

    // [why] Tool result goes back to LLM; only assistant messages are shown to user
    expect(result.status).toBe(200);
    expect(result.data?.actionCard?.state).toBe('confirmed');
    expect(result.data?.message).toBe('Card created.');
    expect(createBoardCardCalls).toHaveLength(1);
    expect(completionCalls).toHaveLength(2);
    // [why] AI response is now persisted as a chat message with isAssistant flag
    expect(writeMessageCalls).toEqual([
      {
        boardId: 'board-1',
        sessionId: 'thread-1',
        authorId: null,
        content: 'Card created.',
        isAssistant: true,
      },
    ]);
  });

  it('rejects unsupported tool calls with a typed 422 error', async () => {
    // [why] All tool calls fail → loop stops immediately with the error
    completionQueue = [
      {
        status: 200,
        data: {
          model: 'gpt-test',
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: {
                name: 'unsupported_tool',
                arguments: '{}',
              },
            },
          ],
        },
      },
    ];

    const result = await assistBoardChat({
      boardId: 'board-1',
      sessionId: 'thread-1',
      prompt: 'Create something',
      request: new Request('http://localhost'),
      actorId: 'user-1',
      board: { id: 'board-1', workspace_id: 'workspace-1', title: 'Board', state: 'ACTIVE' },
    });

    // [why] All tools failed, no messages accumulated → error returned directly
    expect(result.status).toBe(422);
    expect(result.name).toBe('unsupported-tool');
    expect(createBoardCardCalls).toHaveLength(0);
    expect(completionCalls).toHaveLength(1);
    expect(writeMessageCalls).toEqual([]);
  });
});
