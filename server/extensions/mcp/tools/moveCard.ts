import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerMoveCard(server: McpServer, token: string): void {
  server.tool(
    'move_card',
    'Move a card to a different list, optionally after a specific card.',
    {
      cardId: z.string().describe('ID of the card to move'),
      targetListId: z.string().describe('ID of the destination list'),
      afterCardId: z.string().nullable().optional().describe('Insert after this card ID (null places at top)'),
      position: z.number().optional().describe('Deprecated alias. Only 0 is supported and maps to top'),
    },
    async ({ cardId, targetListId, afterCardId, position }) => {
      if (afterCardId === undefined && position !== undefined && position !== 0) {
        return {
          content: [{ type: 'text', text: 'Error: bad-request (position is deprecated; use afterCardId)' }],
          isError: true,
        };
      }

      let resolvedAfterCardId: string | null | undefined;
      if (afterCardId !== undefined) {
        resolvedAfterCardId = afterCardId;
      } else if (position === 0) {
        resolvedAfterCardId = null;
      }
      const result = await apiCall<{ data: unknown }>({
        method: 'PATCH',
        path: `/api/v1/cards/${cardId}/move`,
        body: { targetListId, afterCardId: resolvedAfterCardId },
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
