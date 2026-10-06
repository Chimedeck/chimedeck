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

const { registerGetStateTransitions } = await import('./getStateTransitions');

describe('registerGetStateTransitions', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handlerRegistered = false;
  });

  test('registers the stable get_state_transitions tool contract', () => {
    registerGetStateTransitions(server as never, 'token-1');

    expect(toolName).toBe('get_state_transitions');
    expect(toolDescription).toBe("Get state transition graph and enabled flag for a board.");
    expect(handlerRegistered).toBeTrue();
  });
});
