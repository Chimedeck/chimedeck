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

const { registerSetStateTransitions } = await import('./setStateTransitions');

describe('registerSetStateTransitions', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handlerRegistered = false;
  });

  test('registers the stable set_state_transitions tool contract', () => {
    registerSetStateTransitions(server as never, 'token-1');

    expect(toolName).toBe('set_state_transitions');
    expect(toolDescription).toBe("Update state transition graph and/or enabled flag for a board.");
    expect(handlerRegistered).toBeTrue();
  });
});
