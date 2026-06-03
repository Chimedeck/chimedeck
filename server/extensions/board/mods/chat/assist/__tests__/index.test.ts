import { beforeEach, describe, expect, it } from 'bun:test';
import type { BoardChatAssistOutput } from '../../../../types';

let completionResult: BoardChatAssistOutput;
let completionCalls: Array<{ messages: unknown[]; tools?: unknown[] }> = [];
let createBoardCardCalls: Array<unknown> = [];
let recentMessagesCalls: Array<{ boardId: string; limit: number }> = [];

const assistModule = await import('../index');
const { assistBoardChat, boardChatAssistDeps } = assistModule;

beforeEach(() => {
  completionResult = {
    status: 200,
    data: {
      model: 'gpt-test',
      message: 'Plain text reply',
    },
  };
  completionCalls = [];
  createBoardCardCalls = [];
  recentMessagesCalls = [];

  boardChatAssistDeps.fetchRecentBoardMessages = async ({ boardId, limit }) => {
    recentMessagesCalls.push({ boardId, limit });
    return [];
  };
  boardChatAssistDeps.requestBoardChatAssistCompletion = async (input) => {
    completionCalls.push(input);
    return completionResult;
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
});

describe('assistBoardChat', () => {
  it('returns the plain assistant response when no tool call is requested', async () => {
    const result = await assistBoardChat({
      boardId: 'board-1',
      prompt: 'What should we do next?',
      contextLimit: 3,
      request: new Request('http://localhost'),
      actorId: 'user-1',
      board: { id: 'board-1', workspace_id: 'workspace-1', title: 'Board', state: 'ACTIVE' },
    });

    expect(result.status).toBe(200);
    expect(result.data?.message).toBe('Plain text reply');
    expect(completionCalls).toHaveLength(1);
    expect(completionCalls[0]?.tools).toHaveLength(1);
    expect(createBoardCardCalls).toHaveLength(0);
    expect(recentMessagesCalls).toEqual([{ boardId: 'board-1', limit: 3 }]);
  });

  it('executes create_board_card tool calls and returns action metadata', async () => {
    completionResult = {
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
    };

    const result = await assistBoardChat({
      boardId: 'board-1',
      prompt: 'Create a planning card',
      request: new Request('http://localhost'),
      actorId: 'user-1',
      board: { id: 'board-1', workspace_id: 'workspace-1', title: 'Board', state: 'ACTIVE' },
    });

    expect(result.status).toBe(200);
    expect(result.data?.actionCard?.state).toBe('confirmed');
    expect(result.data?.actionCard?.cardTitle).toBe('Plan launch');
    expect(createBoardCardCalls).toHaveLength(1);
  });

  it('rejects unsupported tool calls with a typed 422 error', async () => {
    completionResult = {
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
    };

    const result = await assistBoardChat({
      boardId: 'board-1',
      prompt: 'Create something',
      request: new Request('http://localhost'),
      actorId: 'user-1',
      board: { id: 'board-1', workspace_id: 'workspace-1', title: 'Board', state: 'ACTIVE' },
    });

    expect(result.status).toBe(422);
    expect(result.name).toBe('invalid-tool-payload');
    expect(createBoardCardCalls).toHaveLength(0);
  });
});
