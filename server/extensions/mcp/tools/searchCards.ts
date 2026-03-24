import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerSearchCards(server: McpServer, token: string): void {
  server.tool(
    'search_cards',
    'Full-text search over cards within a workspace.',
    {
      workspaceId: z.string().describe('ID of the workspace to search within'),
      q: z.string().describe('Full-text search query'),
      limit: z.number().optional().describe('Maximum number of results to return (default: 20)'),
    },
    async ({ workspaceId, q, limit }) => {
      const params = new URLSearchParams({ q });
      if (limit !== undefined) params.set('limit', String(limit));

      const result = await apiCall<{ data: unknown[] }>({
        method: 'GET',
        path: `/api/v1/workspaces/${workspaceId}/search?${params.toString()}`,
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
