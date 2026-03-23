#!/usr/bin/env bun
/**
 * Horiflow MCP server — stdio transport.
 * Run: HORIFLOW_TOKEN=hf_... bun server/extensions/mcp/index.ts
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Import config early so startup validation runs before anything else.
import './config';
import { registerMcpTools } from './registerTools';

const server = new McpServer({ name: 'horiflow', version: '1.0.0' });

registerMcpTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
