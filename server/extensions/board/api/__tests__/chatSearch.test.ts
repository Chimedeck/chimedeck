import { beforeEach, describe, expect, it } from 'bun:test';
import type { SearchBoardChatMessagesOutput } from '../../types';

type BoardRow = {
  id: string;
  workspace_id: string;
  state: string;
};

let board: BoardRow;
let callerRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST' = 'MEMBER';
let guestAccessError: Response | null = null;
let searchResult: SearchBoardChatMessagesOutput = {
  status: 200,
  data: [
    {
      id: 'message-1',
      thread_id: 'thread-1',
      board_id: 'board-1',
      author_id: 'user-1',
      content: 'hello',
      created_at: '2026-06-03T00:00:00.000Z',
      updated_at: '2026-06-03T00:00:00.000Z',
      userName: 'User 1',
      avatar: null,
      score: 0.98,
    },
  ],
};

const chatSearchModule = await import('../chatSearch/create');
const { handleCreateChatSearch, boardChatSearchApiDeps } = chatSearchModule;

beforeEach(() => {
  board = { id: 'board-1', workspace_id: 'workspace-1', state: 'ACTIVE' };
  callerRole = 'MEMBER';
  guestAccessError = null;
  searchResult = {
    status: 200,
    data: [
      {
        id: 'message-1',
        thread_id: 'thread-1',
        board_id: 'board-1',
        author_id: 'user-1',
        content: 'hello',
        created_at: '2026-06-03T00:00:00.000Z',
        updated_at: '2026-06-03T00:00:00.000Z',
        userName: 'User 1',
        avatar: null,
        score: 0.98,
      },
    ],
  };

  boardChatSearchApiDeps.requireBoardAccess = async (req: Request & { board?: BoardRow }, boardId: string) => {
    if (board.id !== boardId) {
      return Response.json({ error: { code: 'board-not-found', message: 'Board not found' } }, { status: 404 });
    }
    req.board = board;
    return null;
  };
  boardChatSearchApiDeps.requireWorkspaceMembership = async (
    req: Request & { callerRole?: string; workspaceId?: string },
    workspaceId: string,
  ) => {
    req.workspaceId = workspaceId;
    req.callerRole = callerRole;
    return null;
  };
  boardChatSearchApiDeps.requireGuestCanViewBoardChat = async () => guestAccessError;
  boardChatSearchApiDeps.searchBoardChatMessages = async () => searchResult;
});

describe('POST /api/v1/boards/:boardId/chat/search', () => {
  it('returns semantic search hits for valid requests', async () => {
    const response = await handleCreateChatSearch(
      new Request('http://localhost/api/v1/boards/board-1/chat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'find this', limit: 10 }),
      }),
      'board-1',
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string; score: number }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.id).toBe('message-1');
    expect(body.data[0]?.score).toBe(0.98);
  });

  it('rejects invalid JSON bodies', async () => {
    const response = await handleCreateChatSearch(
      new Request('http://localhost/api/v1/boards/board-1/chat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
      'board-1',
    );

    expect(response.status).toBe(400);
  });

  it('rejects guests when chat view is denied', async () => {
    callerRole = 'GUEST';
    guestAccessError = Response.json(
      { name: 'guest-chat-view-denied', data: { message: 'Guest does not have permission to view board chat history' } },
      { status: 403 },
    );

    const response = await handleCreateChatSearch(
      new Request('http://localhost/api/v1/boards/board-1/chat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'hello' }),
      }),
      'board-1',
    );

    expect(response.status).toBe(403);
  });

  it('maps search validation errors from the search module', async () => {
    searchResult = {
      status: 400,
      name: 'search-query-too-short',
      message: 'query must be at least 2 characters',
    };

    const response = await handleCreateChatSearch(
      new Request('http://localhost/api/v1/boards/board-1/chat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'x' }),
      }),
      'board-1',
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('search-query-too-short');
  });
});
