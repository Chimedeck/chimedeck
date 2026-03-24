#!/usr/bin/env bun
/**
 * Taskinate MCP server — stdio transport.
 * Run: TASKINATE_TOKEN=hf_... bun server/extensions/mcp/index.ts
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config';
import { registerMcpTools } from './registerTools';

// Validate the token early — stdio server calls the API as a single user.
if (!config.token) {
  console.error(
    'Error: TASKINATE_TOKEN is not set.\n' +
      'Generate an API token in User Settings → API Tokens and set it as:\n' +
      '  export TASKINATE_TOKEN=hf_...'
  );
  process.exit(1);
}

const server = new McpServer({ name: 'taskinate', version: '1.0.0' });

registerMcpTools(server, config.token);

const transport = new StdioServerTransport();
await server.connect(transport);
