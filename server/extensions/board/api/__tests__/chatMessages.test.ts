import { beforeEach, describe, expect, it } from 'bun:test';

type BoardRow = {
  id: string;
  workspace_id: string;
  state: 'ACTIVE' | 'ARCHIVED';
};

let board: BoardRow;
let authenticated = true;
let callerRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST' = 'MEMBER';
let guestAccessError: Response | null = null;
let writeCalls: Array<{ boardId: string; authorId: string; content: string }> = [];

const chatMessagesModule = await import('../chatMessages/create');
const { handleCreateChatMessage, boardChatApiDeps } = chatMessagesModule;

beforeEach(() => {
  board = { id: 'board-1', workspace_id: 'workspace-1', state: 'ACTIVE' };
  authenticated = true;
  callerRole = 'MEMBER';
  guestAccessError = null;
  writeCalls = [];

  boardChatApiDeps.authenticate = async (req: Request & { currentUser?: { id: string } }) => {
    if (!authenticated) {
      return Response.json({ name: 'unauthorized', data: { message: 'Authentication required' } }, { status: 401 });
    }
    req.currentUser = { id: 'user-1' };
    return null;
  };
  boardChatApiDeps.requireBoardAccess = async (req: Request & { board?: BoardRow }, boardId: string) => {
    if (board.id !== boardId) {
      return Response.json({ error: { code: 'board-not-found', message: 'Board not found' } }, { status: 404 });
    }
    req.board = board;
    return null;
  };
  boardChatApiDeps.requireWorkspaceMembership = async (
    req: Request & { callerRole?: string; workspaceId?: string },
    workspaceId: string,
  ) => {
    req.workspaceId = workspaceId;
    req.callerRole = callerRole;
    return null;
  };
  boardChatApiDeps.requireGuestCanUseBoardChat = async () => guestAccessError;
  boardChatApiDeps.writeBoardChatMessage = async (input: { boardId: string; authorId: string; content: string }) => {
    writeCalls.push(input);
    return {
      status: 201,
      data: {
        thread: {
          id: 'thread-1',
          board_id: input.boardId,
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
          last_message_at: '2026-06-03T00:00:00.000Z',
        },
        message: {
          id: 'message-1',
          thread_id: 'thread-1',
          board_id: input.boardId,
          author_id: input.authorId,
          content: input.content,
          created_at: '2026-06-03T00:00:00.000Z',
          updated_at: '2026-06-03T00:00:00.000Z',
        },
        vector: null,
        queuedForEmbeddingRetry: false,
      },
    };
  };
});

describe('POST /api/v1/boards/:boardId/chat/messages', () => {
  it('creates a chat message for authenticated members', async () => {
    const response = await handleCreateChatMessage(
      new Request('http://localhost/api/v1/boards/board-1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '  hello chat  ' }),
      }),
      'board-1',
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { data: { content: string } };
    expect(body.data.content).toBe('hello chat');
    expect(writeCalls).toEqual([
      {
        boardId: 'board-1',
        authorId: 'user-1',
        content: 'hello chat',
      },
    ]);
  });

  it('rejects invalid JSON bodies', async () => {
    const response = await handleCreateChatMessage(
      new Request('http://localhost/api/v1/boards/board-1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
      'board-1',
    );

    expect(response.status).toBe(400);
  });

  it('rejects missing content', async () => {
    const response = await handleCreateChatMessage(
      new Request('http://localhost/api/v1/boards/board-1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '   ' }),
      }),
      'board-1',
    );

    expect(response.status).toBe(400);
  });

  it('rejects guests when chat use is denied', async () => {
    callerRole = 'GUEST';
    guestAccessError = Response.json(
      { name: 'guest-chat-use-denied', data: { message: 'Guest does not have permission to send board chat messages' } },
      { status: 403 },
    );

    const response = await handleCreateChatMessage(
      new Request('http://localhost/api/v1/boards/board-1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      }),
      'board-1',
    );

    expect(response.status).toBe(403);
    expect(writeCalls).toHaveLength(0);
  });

  it('rejects archived boards', async () => {
    board.state = 'ARCHIVED';

    const response = await handleCreateChatMessage(
      new Request('http://localhost/api/v1/boards/board-1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      }),
      'board-1',
    );

    expect(response.status).toBe(403);
    expect(writeCalls).toHaveLength(0);
  });

  it('rejects unauthenticated callers', async () => {
    authenticated = false;

    const response = await handleCreateChatMessage(
      new Request('http://localhost/api/v1/boards/board-1/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      }),
      'board-1',
    );

    expect(response.status).toBe(401);
  });
});
