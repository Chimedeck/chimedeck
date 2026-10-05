import { beforeEach, describe, expect, mock, test } from 'bun:test';

const apiCallMock = mock();

void mock.module('../apiClient', () => ({
  apiCall: apiCallMock,
}));

type ToolHandler = (args: { listId: string; title: string; description?: string }) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

let toolName = '';
let toolDescription = '';
let handler: ToolHandler | undefined;

const server = {
  registerTool: (
    name: string,
    config: { description: string; inputSchema: unknown },
    registeredHandler: ToolHandler
  ) => {
    toolName = name;
    toolDescription = config.description;
    handler = registeredHandler;
  },
};

const { registerCreateCard } = await import('./createCard');

describe('registerCreateCard', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handler = undefined;
    apiCallMock.mockReset();
  });

  test('registers create_card and posts the card fields to its list endpoint', async () => {
    apiCallMock.mockResolvedValue({ data: { data: { id: 'card-1', title: 'Demo card' } } });

    registerCreateCard(server as never, 'token-1');

    expect(toolName).toBe('create_card');
    expect(toolDescription).toContain('card');

    const registeredHandler = handler;
    if (!registeredHandler) throw new Error('create_card handler was not registered');

    const result = await registeredHandler({
      listId: 'list-1',
      title: 'Demo card',
      description: 'Created through MCP',
    });

    expect(apiCallMock).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/v1/lists/list-1/cards',
      body: { title: 'Demo card', description: 'Created through MCP' },
      token: 'token-1',
    });
    expect(result).toEqual({
      content: [{ type: 'text', text: JSON.stringify({ data: { id: 'card-1', title: 'Demo card' } }) }],
    });
  });

  test('returns a structured MCP error when card creation is rejected', async () => {
    apiCallMock.mockResolvedValue({ error: { name: 'forbidden' } });
    registerCreateCard(server as never, 'token-1');

    const registeredHandler = handler;
    if (!registeredHandler) throw new Error('create_card handler was not registered');

    const result = await registeredHandler({ listId: 'list-1', title: 'Demo card' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: forbidden' }],
      isError: true,
    });
  });
});
