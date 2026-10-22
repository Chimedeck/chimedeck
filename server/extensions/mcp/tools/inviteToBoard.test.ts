import { beforeEach, describe, expect, test } from 'bun:test';
import type { z } from 'zod';

let toolName = '';
let toolDescription = '';
let inputSchema: Record<string, z.ZodType> | undefined;
let handlerRegistered = false;

const server = {
  registerTool: (
    name: string,
    config: { description: string; inputSchema: Record<string, z.ZodType> },
    _handler: unknown,
  ) => {
    toolName = name;
    toolDescription = config.description;
    inputSchema = config.inputSchema;
    handlerRegistered = true;
  },
};

const { registerInviteToBoard } = await import('./inviteToBoard');

describe('registerInviteToBoard', () => {
  beforeEach(() => {
    toolName = '';
    toolDescription = '';
    inputSchema = undefined;
    handlerRegistered = false;
  });

  test('registers the stable invite_to_board tool contract', () => {
    registerInviteToBoard(server as never, 'token-1');

    expect(toolName).toBe('invite_to_board');
    expect(toolDescription).toBe("Invite a user to a board by email. Requires the token holder to be a board admin.");
    expect(handlerRegistered).toBeTrue();
  });

  test('uses the non-deprecated email schema', () => {
    registerInviteToBoard(server as never, 'token-1');

    const emailSchema = inputSchema?.email;
    if (!emailSchema) throw new Error('invite_to_board email schema was not registered');
    expect(emailSchema.safeParse('not-an-email').success).toBeFalse();
  });
});
