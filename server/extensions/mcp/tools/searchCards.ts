import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerSearchCards(server: McpServer, token: string): void {
  server.tool(
    'search_cards',
    'Full-text search over cards within a workspace.',
    {
      workspaceId: z.string().describe('ID of the workspace to search within'),
      query: z.string().optional().describe('Full-text search query'),
      q: z.string().optional().describe('Deprecated alias for full-text search query'),
      limit: z.number().optional().describe('Maximum number of results to return (default: 20)'),
    },
    async ({ workspaceId, query, q, limit }) => {
      const resolvedQuery = query ?? q;
      if (!resolvedQuery || resolvedQuery.trim() === '') {
        return {
          content: [{ type: 'text', text: 'Error: bad-request (query is required)' }],
          isError: true,
        };
      }

      const params = new URLSearchParams({ query: resolvedQuery });
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
