import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMoveCard } from './tools/moveCard';
import { registerWriteComment } from './tools/writeComment';
import { registerCreateCard } from './tools/createCard';
import { registerCreateBoard } from './tools/createBoard';
import { registerCreateList } from './tools/createList';
import { registerEditDescription } from './tools/editDescription';
import { registerSetCardPrice } from './tools/setCardPrice';
import { registerInviteToBoard } from './tools/inviteToBoard';
import { registerSearchCards } from './tools/searchCards';
import { registerSearchBoard } from './tools/searchBoard';
import { registerGetCard } from './tools/getCard';
import { registerGetStateTransitions } from './tools/getStateTransitions';
import { registerSetStateTransitions } from './tools/setStateTransitions';
import { registerGetStateTransitionRules } from './tools/getStateTransitionRules';
import { registerCopyStateTransitions } from './tools/copyStateTransitions';

// token is threaded through to every tool so each API call uses the correct
// credential — the env token for stdio mode, the request's Bearer token for HTTP mode.
export function registerMcpTools(server: McpServer, token: string): void {
  registerMoveCard(server, token);
  registerWriteComment(server, token);
  registerCreateCard(server, token);
  registerCreateBoard(server, token);
  registerCreateList(server, token);
  registerEditDescription(server, token);
  registerSetCardPrice(server, token);
  registerInviteToBoard(server, token);
  registerSearchCards(server, token);
  registerSearchBoard(server, token);
  registerGetCard(server, token);
  registerGetStateTransitions(server, token);
  registerSetStateTransitions(server, token);
  registerGetStateTransitionRules(server, token);
  registerCopyStateTransitions(server, token);
}
