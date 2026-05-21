import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerGetStateTransitions(server: McpServer, token: string): void {
  server.tool(
    'get_state_transitions',
    'Get state transition graph and enabled flag for a board.',
    {
      boardId: z.string().describe('ID of the board'),
    },
    async ({ boardId }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'GET',
        path: `/api/v1/boards/${boardId}/state-transitions`,
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
