import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerGetCard(server: McpServer, token: string): void {
  server.tool(
    'get_card',
    'Retrieve the full details of a single card by its ID.',
    {
      cardId: z.string().describe('ID of the card to retrieve'),
    },
    async ({ cardId }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'GET',
        path: `/api/v1/cards/${cardId}`,
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
