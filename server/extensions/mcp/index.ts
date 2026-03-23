#!/usr/bin/env bun
/**
 * Horiflow MCP server — stdio transport.
 * Run: HORIFLOW_TOKEN=hf_... bun server/extensions/mcp/index.ts
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config';
import { registerMcpTools } from './registerTools';

// Validate the token early — stdio server calls the API as a single user.
if (!config.token) {
  console.error(
    'Error: HORIFLOW_TOKEN is not set.\n' +
      'Generate an API token in User Settings → API Tokens and set it as:\n' +
      '  export HORIFLOW_TOKEN=hf_...'
  );
  process.exit(1);
}

const server = new McpServer({ name: 'horiflow', version: '1.0.0' });

registerMcpTools(server, config.token);

const transport = new StdioServerTransport();
await server.connect(transport);
