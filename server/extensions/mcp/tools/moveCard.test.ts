import { beforeEach, describe, expect, mock, test } from 'bun:test';

const apiCallMock = mock();

void mock.module('../apiClient', () => ({
  apiCall: apiCallMock,
}));

type MoveCardArgs = {
  cardId: string;
  targetListId: string;
  afterCardId?: string | null;
  position?: number;
};

type ToolHandler = (args: MoveCardArgs) => Promise<{
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
    registeredHandler: ToolHandler,
  ) => {
    toolName = name;
    toolDescription = config.description;
    handler = registeredHandler;
  },
};

const { registerMoveCard } = await import('./moveCard');

function registeredHandler(): ToolHandler {
  if (!handler) throw new Error('move_card handler was not registered');
  return handler;
}

describe('registerMoveCard', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handler = undefined;
    apiCallMock.mockReset();
  });

  test('registers move_card and sends the destination and insertion card', async () => {
    apiCallMock.mockResolvedValue({ data: { data: { id: 'card-1' } } });
    registerMoveCard(server as never, 'token-1');

    expect(toolName).toBe('move_card');
    expect(toolDescription).toContain('Move a card');

    const result = await registeredHandler()({
      cardId: 'card-1',
      targetListId: 'list-2',
      afterCardId: 'card-0',
    });

    expect(apiCallMock).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/api/v1/cards/card-1/move',
      body: { targetListId: 'list-2', afterCardId: 'card-0' },
      token: 'token-1',
    });
    expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify({ data: { id: 'card-1' } }) }] });
  });

  test('maps the supported legacy top position to a null insertion card', async () => {
    apiCallMock.mockResolvedValue({ data: { data: { id: 'card-1' } } });
    registerMoveCard(server as never, 'token-1');

    await registeredHandler()({ cardId: 'card-1', targetListId: 'list-2', position: 0 });

    expect(apiCallMock).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/api/v1/cards/card-1/move',
      body: { targetListId: 'list-2', afterCardId: null },
      token: 'token-1',
    });
  });

  test('rejects unsupported legacy positions without calling the API', async () => {
    registerMoveCard(server as never, 'token-1');

    const result = await registeredHandler()({ cardId: 'card-1', targetListId: 'list-2', position: 2 });

    expect(apiCallMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: bad-request (position is deprecated; use afterCardId)' }],
      isError: true,
    });
  });
});
