import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerGetStateTransitionRules(server: McpServer, token: string): void {
  server.tool(
    'get_state_transition_rules',
    'Get enforceable state-transition rules for a board.',
    {
      boardId: z.string().describe('ID of the board'),
    },
    async ({ boardId }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'GET',
        path: `/api/v1/boards/${boardId}/state-transitions/rules`,
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
