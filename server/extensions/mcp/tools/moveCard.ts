import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerMoveCard(server: McpServer): void {
  server.tool(
    'move_card',
    'Move a card to a different list, optionally at a specific position.',
    {
      cardId: z.string().describe('ID of the card to move'),
      targetListId: z.string().describe('ID of the destination list'),
      position: z.number().optional().describe('Zero-based position within the target list'),
    },
    async ({ cardId, targetListId, position }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'PATCH',
        path: `/api/v1/cards/${cardId}/move`,
        body: { targetListId, position },
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
