import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMoveCard } from './tools/moveCard';
import { registerWriteComment } from './tools/writeComment';
import { registerCreateCard } from './tools/createCard';
import { registerEditDescription } from './tools/editDescription';
import { registerSetCardPrice } from './tools/setCardPrice';
import { registerInviteToBoard } from './tools/inviteToBoard';

export function registerMcpTools(server: McpServer): void {
  registerMoveCard(server);
  registerWriteComment(server);
  registerCreateCard(server);
  registerEditDescription(server);
  registerSetCardPrice(server);
  registerInviteToBoard(server);
}
