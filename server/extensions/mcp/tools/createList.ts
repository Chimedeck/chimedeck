import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerCreateList(server: McpServer, token: string): void {
  server.tool(
    'create_list',
    'Create a new list in a specified board.',
    {
      boardId: z.string().describe('ID of the board to create the list in'),
      title: z.string().min(1).describe('Title of the new list'),
      afterId: z
        .string()
        .nullable()
        .optional()
        .describe('Optional list ID after which to insert the new list'),
    },
    async ({ boardId, title, afterId }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'POST',
        path: `/api/v1/boards/${boardId}/lists`,
        body: { title, afterId },
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
