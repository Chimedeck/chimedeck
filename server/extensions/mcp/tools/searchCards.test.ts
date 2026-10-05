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

const { registerSearchCards } = await import('./searchCards');

describe('registerSearchCards', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handlerRegistered = false;
  });

  test('registers the stable search_cards tool contract', () => {
    registerSearchCards(server as never, 'token-1');

    expect(toolName).toBe('search_cards');
    expect(toolDescription).toBe("Full-text search over cards within a workspace.");
    expect(handlerRegistered).toBeTrue();
  });
});
