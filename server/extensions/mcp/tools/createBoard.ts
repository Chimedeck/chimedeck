import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerCreateBoard(server: McpServer, token: string): void {
  server.tool(
    'create_board',
    'Create a new board in a specified workspace.',
    {
      workspaceId: z.string().describe('ID of the workspace to create the board in'),
      title: z.string().min(1).describe('Title of the new board'),
      visibility: z
        .enum(['PRIVATE', 'WORKSPACE', 'PUBLIC'])
        .optional()
        .describe('Optional board visibility; defaults to PRIVATE'),
      description: z.string().optional().describe('Optional board description'),
      background: z.string().optional().describe('Optional board background value'),
    },
    async ({ workspaceId, title, visibility, description, background }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'POST',
        path: `/api/v1/workspaces/${workspaceId}/boards`,
        body: { title, visibility, description, background },
        token,
      });

      if ('error' in result) {
        return {
          content: [{ type: 'text', text: `Error: ${result.error.name}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result.data) }],
      };
    }
  );
}
