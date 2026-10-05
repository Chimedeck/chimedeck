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

const { registerGetStateTransitionRules } = await import('./getStateTransitionRules');

describe('registerGetStateTransitionRules', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handlerRegistered = false;
  });

  test('registers the stable get_state_transition_rules tool contract', () => {
    registerGetStateTransitionRules(server as never, 'token-1');

    expect(toolName).toBe('get_state_transition_rules');
    expect(toolDescription).toBe("Get enforceable state-transition rules for a board.");
    expect(handlerRegistered).toBeTrue();
  });
});
