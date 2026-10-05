import { beforeEach, describe, expect, mock, test } from 'bun:test';

const apiCallMock = mock();

void mock.module('../apiClient', () => ({
  apiCall: apiCallMock,
}));

type ToolHandler = (args: { cardId: string }) => Promise<{
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

const { registerGetCard } = await import('./getCard');

describe('registerGetCard', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handler = undefined;
    apiCallMock.mockReset();
  });

  test('registers get_card and reads the requested card endpoint', async () => {
    apiCallMock.mockResolvedValue({ data: { data: { id: 'card-1', title: 'Demo card' } } });

    registerGetCard(server as never, 'token-1');

    expect(toolName).toBe('get_card');
    expect(toolDescription).toContain('card');

    const registeredHandler = handler;
    if (!registeredHandler) throw new Error('get_card handler was not registered');

    const result = await registeredHandler({ cardId: 'card-1' });

    expect(apiCallMock).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/v1/cards/card-1',
      token: 'token-1',
    });
    expect(result).toEqual({
      content: [{ type: 'text', text: JSON.stringify({ data: { id: 'card-1', title: 'Demo card' } }) }],
    });
  });

  test('returns a structured MCP error when the card cannot be read', async () => {
    apiCallMock.mockResolvedValue({ error: { name: 'not_found' } });
    registerGetCard(server as never, 'token-1');

    const registeredHandler = handler;
    if (!registeredHandler) throw new Error('get_card handler was not registered');

    const result = await registeredHandler({ cardId: 'card-1' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: not_found' }],
      isError: true,
    });
  });
});
