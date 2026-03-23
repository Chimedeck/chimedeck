#!/usr/bin/env bun
/**
 * Horiflow MCP server — stdio transport.
 * Run: HORIFLOW_TOKEN=hf_... bun server/extensions/mcp/index.ts
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Import config early so startup validation runs before anything else.
import './config';
import { registerMoveCard } from './tools/moveCard';
import { registerWriteComment } from './tools/writeComment';
import { registerCreateCard } from './tools/createCard';
import { registerEditDescription } from './tools/editDescription';
import { registerSetCardPrice } from './tools/setCardPrice';
import { registerInviteToBoard } from './tools/inviteToBoard';

const server = new McpServer({ name: 'horiflow', version: '1.0.0' });

registerMoveCard(server);
registerWriteComment(server);
registerCreateCard(server);
registerEditDescription(server);
registerSetCardPrice(server);
registerInviteToBoard(server);

const transport = new StdioServerTransport();
await server.connect(transport);
