import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerCreateCard(server: McpServer, token: string): void {
  server.tool(
    'create_card',
    'Create a new card in a specified list.',
    {
      listId: z.string().describe('ID of the list to create the card in'),
      title: z.string().describe('Title of the new card'),
      description: z.string().optional().describe('Optional description for the new card'),
    },
    async ({ listId, title, description }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'POST',
        path: `/api/v1/lists/${listId}/cards`,
        body: { title, description },
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
    },
  );
}
