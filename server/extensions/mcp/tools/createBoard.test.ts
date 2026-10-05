import { beforeEach, describe, expect, mock, test } from 'bun:test';

const apiCallMock = mock();

mock.module('../apiClient', () => ({
  apiCall: apiCallMock,
}));

type ToolHandler = (args: {
  workspaceId: string;
  title: string;
  visibility?: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';
  description?: string;
  background?: string;
}) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

let toolName = '';
let handler: ToolHandler | undefined;

const server = {
  tool: (name: string, _description: string, _schema: unknown, registeredHandler: ToolHandler) => {
    toolName = name;
    handler = registeredHandler;
  },
};

const { registerCreateBoard } = await import('./createBoard');

describe('registerCreateBoard', () => {
  beforeEach(() => {
    toolName = '';
    handler = undefined;
    apiCallMock.mockReset();
  });

  test('registers create_board and posts optional board fields to its workspace endpoint', async () => {
    apiCallMock.mockResolvedValue({ data: { data: { id: 'board-1', title: 'Demo board' } } });

    registerCreateBoard(server as never, 'token-1');

    expect(toolName).toBe('create_board');
    expect(handler).toBeDefined();

    const result = await handler!({
      workspaceId: 'workspace-1',
      title: 'Demo board',
      visibility: 'WORKSPACE',
      description: 'MCP-created board',
      background: '#123456',
    });

    expect(apiCallMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/v1/workspaces/workspace-1/boards',
      body: {
        title: 'Demo board',
        visibility: 'WORKSPACE',
        description: 'MCP-created board',
        background: '#123456',
      },
      token: 'token-1',
    });
    expect(result).toEqual({
      content: [
        { type: 'text', text: JSON.stringify({ data: { id: 'board-1', title: 'Demo board' } }) },
      ],
    });
  });

  test('returns a structured MCP error when board creation is rejected', async () => {
    apiCallMock.mockResolvedValue({ error: { name: 'forbidden' } });
    registerCreateBoard(server as never, 'token-1');

    const result = await handler!({ workspaceId: 'workspace-1', title: 'Demo board' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: forbidden' }],
      isError: true,
    });
  });
});
