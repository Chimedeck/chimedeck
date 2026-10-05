import { beforeEach, describe, expect, mock, test } from 'bun:test';

const apiCallMock = mock();

mock.module('../apiClient', () => ({
  apiCall: apiCallMock,
}));

type ToolHandler = (args: { boardId: string; title: string; afterId?: string | null }) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

let toolName = '';
let toolDescription = '';
let handler: ToolHandler | undefined;

const server = {
  tool: (name: string, description: string, _schema: unknown, registeredHandler: ToolHandler) => {
    toolName = name;
    toolDescription = description;
    handler = registeredHandler;
  },
};

const { registerCreateList } = await import('./createList');

describe('registerCreateList', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handler = undefined;
    apiCallMock.mockReset();
  });

  test('registers create_list and posts a list title to its board endpoint', async () => {
    apiCallMock.mockResolvedValue({ data: { data: { id: 'list-1', title: 'Backlog' } } });

    registerCreateList(server as never, 'token-1');

    expect(toolName).toBe('create_list');
    expect(toolDescription).toContain('list');
    expect(handler).toBeDefined();

    const result = await handler!({ boardId: 'board-1', title: 'Backlog' });

    expect(apiCallMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/v1/boards/board-1/lists',
      body: { title: 'Backlog', afterId: undefined },
      token: 'token-1',
    });
    expect(result).toEqual({
      content: [
        { type: 'text', text: JSON.stringify({ data: { id: 'list-1', title: 'Backlog' } }) },
      ],
    });
  });

  test('returns a structured MCP error when list creation is rejected', async () => {
    apiCallMock.mockResolvedValue({ error: { name: 'forbidden' } });
    registerCreateList(server as never, 'token-1');

    const result = await handler!({ boardId: 'board-1', title: 'Backlog' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: forbidden' }],
      isError: true,
    });
  });
});
