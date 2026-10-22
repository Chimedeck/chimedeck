import { beforeEach, describe, expect, test } from 'bun:test';

let toolName = '';
let toolDescription = '';
let handlerRegistered = false;

const server = {
  registerTool: (
    name: string,
    config: { description: string; inputSchema: unknown },
    _handler: unknown,
  ) => {
    toolName = name;
    toolDescription = config.description;
    handlerRegistered = true;
  },
};

const { registerSearchBoard } = await import('./searchBoard');

describe('registerSearchBoard', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handlerRegistered = false;
  });

  test('registers the stable search_board tool contract', () => {
    registerSearchBoard(server as never, 'token-1');

    expect(toolName).toBe('search_board');
    expect(toolDescription).toBe("Full-text search over cards and lists scoped to a single board.");
    expect(handlerRegistered).toBeTrue();
  });
});
