import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerSearchBoard(server: McpServer, token: string): void {
  server.tool(
    'search_board',
    'Full-text search over cards and lists scoped to a single board.',
    {
      boardId: z.string().describe('ID of the board to search within'),
      q: z.string().describe('Full-text search query'),
      limit: z.number().optional().describe('Maximum number of results to return'),
    },
    async ({ boardId, q, limit }) => {
      const params = new URLSearchParams({ q });
      if (limit !== undefined) params.set('limit', String(limit));

      const result = await apiCall<{ data: unknown[] }>({
        method: 'GET',
        path: `/api/v1/boards/${boardId}/search?${params.toString()}`,
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
