import { beforeEach, describe, expect, it } from 'bun:test';

type BoardRow = {
  id: string;
  workspace_id: string;
  title: string;
  state: 'ACTIVE' | 'ARCHIVED';
  created_at: string;
};

let board: BoardRow = {
  id: 'board-1',
  workspace_id: 'workspace-1',
  title: 'Board',
  state: 'ACTIVE',
  created_at: new Date().toISOString(),
};
let authenticated = true;
let callerRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST' = 'MEMBER';
let guestAccessError: Response | null = null;
let assistCalls: Array<{
  boardId: string;
  prompt: string;
  contextLimit?: number;
  request: Request;
  actorId: string;
  board: BoardRow;
}> = [];
let assistResult: {
  status: number;
  data?: { message?: string; model: string; actionCard?: unknown; toolCalls?: unknown[] };
  name?: string;
  message?: string;
} = {
  status: 200,
  data: {
    message: 'Suggested next step',
    model: 'gpt-test',
  },
};

const chatAssistModule = await import('../chatAssist/create');
const { handleCreateChatAssist, boardChatAssistApiDeps } = chatAssistModule;

beforeEach(() => {
  board = {
    id: 'board-1',
    workspace_id: 'workspace-1',
    title: 'Board',
    state: 'ACTIVE',
    created_at: new Date().toISOString(),
  };
  authenticated = true;
  callerRole = 'MEMBER';
  guestAccessError = null;
  assistCalls = [];
  assistResult = {
    status: 200,
    data: {
      message: 'Suggested next step',
      model: 'gpt-test',
    },
  };

  boardChatAssistApiDeps.authenticate = (req: Request & { currentUser?: { id: string } }) => {
    if (!authenticated) {
      return Promise.resolve(
        Response.json(
          { name: 'unauthorized', data: { message: 'Authentication required' } },
          { status: 401 }
        )
      );
    }
    req.currentUser = { id: 'user-1' };
    return Promise.resolve(null);
  };
  boardChatAssistApiDeps.requireBoardAccess = (req, boardId) => {
    if (board.id !== boardId) {
      return Promise.resolve(
        Response.json(
          { error: { code: 'board-not-found', message: 'Board not found' } },
          { status: 404 }
        )
      );
    }
    req.board = board as unknown as typeof req.board;
    return Promise.resolve(null);
  };
  boardChatAssistApiDeps.requireWorkspaceMembership = (
    req: Request & { callerRole?: string; workspaceId?: string },
    workspaceId: string
  ) => {
    req.workspaceId = workspaceId;
    req.callerRole = callerRole;
    return Promise.resolve(null);
  };
  boardChatAssistApiDeps.requireGuestCanUseBoardChat = () => Promise.resolve(guestAccessError);
  boardChatAssistApiDeps.assistBoardChat = (input: {
    boardId: string;
    prompt: string;
    contextLimit?: number;
    request: Request;
    actorId: string;
    board: BoardRow;
  }) => {
    assistCalls.push(input);
    return Promise.resolve(assistResult);
  };
});

describe('POST /api/v1/boards/:boardId/chat/assist', () => {
  it('returns assist response for valid requests', async () => {
    const response = await handleCreateChatAssist(
      new Request('http://localhost/api/v1/boards/board-1/chat/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '  What should we do next?  ', contextLimit: 6 }),
      }),
      'board-1'
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { message: string; model: string } };
    expect(body.data.message).toBe('Suggested next step');
    expect(assistCalls).toEqual([
      {
        boardId: 'board-1',
        prompt: 'What should we do next?',
        contextLimit: 6,
        request: expect.any(Request),
        actorId: 'user-1',
        board: {
          id: 'board-1',
          workspace_id: 'workspace-1',
          title: 'Board',
          state: 'ACTIVE',
          created_at: expect.any(String),
        },
      },
    ]);
  });

  it('rejects invalid JSON bodies', async () => {
    const response = await handleCreateChatAssist(
      new Request('http://localhost/api/v1/boards/board-1/chat/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
      'board-1'
    );

    expect(response.status).toBe(400);
    expect(assistCalls).toHaveLength(0);
  });

  it('rejects missing prompt', async () => {
    const response = await handleCreateChatAssist(
      new Request('http://localhost/api/v1/boards/board-1/chat/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '  ' }),
      }),
      'board-1'
    );

    expect(response.status).toBe(400);
    expect(assistCalls).toHaveLength(0);
  });

  it('rejects invalid contextLimit', async () => {
    const response = await handleCreateChatAssist(
      new Request('http://localhost/api/v1/boards/board-1/chat/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'help', contextLimit: 0 }),
      }),
      'board-1'
    );

    expect(response.status).toBe(400);
    expect(assistCalls).toHaveLength(0);
  });

  it('rejects guests when chat use is denied', async () => {
    callerRole = 'GUEST';
    guestAccessError = Response.json(
      {
        name: 'guest-chat-use-denied',
        data: { message: 'Guest does not have permission to send board chat messages' },
      },
      { status: 403 }
    );

    const response = await handleCreateChatAssist(
      new Request('http://localhost/api/v1/boards/board-1/chat/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'help' }),
      }),
      'board-1'
    );

    expect(response.status).toBe(403);
    expect(assistCalls).toHaveLength(0);
  });

  it('rejects archived boards', async () => {
    board.state = 'ARCHIVED';

    const response = await handleCreateChatAssist(
      new Request('http://localhost/api/v1/boards/board-1/chat/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'help' }),
      }),
      'board-1'
    );

    expect(response.status).toBe(403);
    expect(assistCalls).toHaveLength(0);
  });

  it('rejects unauthenticated callers', async () => {
    authenticated = false;

    const response = await handleCreateChatAssist(
      new Request('http://localhost/api/v1/boards/board-1/chat/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'help' }),
      }),
      'board-1'
    );

    expect(response.status).toBe(401);
    expect(assistCalls).toHaveLength(0);
  });

  it('maps assist module errors to endpoint response', async () => {
    assistResult = {
      status: 429,
      name: 'assist-rate-limited',
      message: 'Assist provider rate limit exceeded',
    };

    const response = await handleCreateChatAssist(
      new Request('http://localhost/api/v1/boards/board-1/chat/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'help' }),
      }),
      'board-1'
    );

    expect(response.status).toBe(429);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('assist-rate-limited');
  });

  it('maps tool validation errors to typed 422 responses', async () => {
    assistResult = {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'create_board_card arguments must be valid JSON',
    };

    const response = await handleCreateChatAssist(
      new Request('http://localhost/api/v1/boards/board-1/chat/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'help' }),
      }),
      'board-1'
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('invalid-tool-payload');
  });
});
