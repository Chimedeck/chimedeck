import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerEditDescription(server: McpServer, token: string): void {
  server.tool(
    'edit_card_description',
    'Update the description of an existing card.',
    {
      cardId: z.string().describe('ID of the card to update'),
      description: z.string().describe('New description text for the card'),
    },
    async ({ cardId, description }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'PATCH',
        path: `/api/v1/cards/${cardId}/description`,
        body: { description },
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
