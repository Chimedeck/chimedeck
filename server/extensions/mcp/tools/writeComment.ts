import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerWriteComment(server: McpServer, token: string): void {
  server.tool(
    'write_comment',
    'Post a comment on a card.',
    {
      cardId: z.string().describe('ID of the card to comment on'),
      content: z.string().optional().describe('Comment body text'),
      text: z.string().optional().describe('Deprecated alias for comment body text'),
    },
    async ({ cardId, content, text }) => {
      const commentContent = content ?? text;
      if (!commentContent || commentContent.trim() === '') {
        return {
          content: [{ type: 'text', text: 'Error: bad-request (content is required)' }],
          isError: true,
        };
      }

      const result = await apiCall<{ data: unknown }>({
        method: 'POST',
        path: `/api/v1/cards/${cardId}/comments`,
        body: { content: commentContent },
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
