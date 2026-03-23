import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerWriteComment(server: McpServer): void {
  server.tool(
    'write_comment',
    'Post a comment on a card.',
    {
      cardId: z.string().describe('ID of the card to comment on'),
      text: z.string().describe('Comment body text'),
    },
    async ({ cardId, text }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'POST',
        path: `/api/v1/cards/${cardId}/comments`,
        body: { text },
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
