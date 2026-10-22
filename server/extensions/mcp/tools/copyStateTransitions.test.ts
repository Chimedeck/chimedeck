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

const { registerCopyStateTransitions } = await import('./copyStateTransitions');

describe('registerCopyStateTransitions', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handlerRegistered = false;
  });

  test('registers the stable copy_state_transitions tool contract', () => {
    registerCopyStateTransitions(server as never, 'token-1');

    expect(toolName).toBe('copy_state_transitions');
    expect(toolDescription).toBe("Copy state transition graph from one board to another.");
    expect(handlerRegistered).toBeTrue();
  });
});
