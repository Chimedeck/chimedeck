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

const { registerEditDescription } = await import('./editDescription');

describe('registerEditDescription', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handlerRegistered = false;
  });

  test('registers the stable edit_card_description tool contract', () => {
    registerEditDescription(server as never, 'token-1');

    expect(toolName).toBe('edit_card_description');
    expect(toolDescription).toBe("Update the description of an existing card.");
    expect(handlerRegistered).toBeTrue();
  });
});
