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

const { registerSetCardPrice } = await import('./setCardPrice');

describe('registerSetCardPrice', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handlerRegistered = false;
  });

  test('registers the stable set_card_price tool contract', () => {
    registerSetCardPrice(server as never, 'token-1');

    expect(toolName).toBe('set_card_price');
    expect(toolDescription).toBe("Set or clear the price on a card. Pass amount=null to remove the price.");
    expect(handlerRegistered).toBeTrue();
  });
});
