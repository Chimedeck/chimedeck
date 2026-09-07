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

const { registerWriteComment } = await import('./writeComment');

describe('registerWriteComment', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    handlerRegistered = false;
  });

  test('registers the stable write_comment tool contract', () => {
    registerWriteComment(server as never, 'token-1');

    expect(toolName).toBe('write_comment');
    expect(toolDescription).toBe("Post a comment on a card.");
    expect(handlerRegistered).toBeTrue();
  });
});
