import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerSetCardPrice(server: McpServer, token: string): void {
  server.tool(
    'set_card_price',
    'Set or clear the price on a card. Pass amount=null to remove the price.',
    {
      cardId: z.string().describe('ID of the card to update'),
      // nullable() allows amount: null to explicitly clear the price
      amount: z.number().nullable().describe('Price amount (pass null to clear the price)'),
      currency: z.string().optional().describe('ISO 4217 currency code, e.g. "USD"'),
      label: z.string().optional().describe('Optional display label for the price'),
    },
    async ({ cardId, amount, currency, label }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'PATCH',
        path: `/api/v1/cards/${cardId}/money`,
        body: { amount, currency, label },
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
