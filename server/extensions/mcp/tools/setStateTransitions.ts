import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerSetStateTransitions(server: McpServer, token: string): void {
  server.tool(
    'set_state_transitions',
    'Update state transition graph and/or enabled flag for a board.',
    {
      boardId: z.string().describe('ID of the board'),
      enabled: z.boolean().optional().describe('Enable or disable state transition enforcement'),
      graph: z.unknown().optional().describe('State transition graph payload'),
    },
    async ({ boardId, enabled, graph }) => {
      if (enabled === undefined && graph === undefined) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: bad-request (at least one of enabled or graph is required)',
            },
          ],
          isError: true,
        };
      }

      const body: Record<string, unknown> = {};
      if (enabled !== undefined) body.enabled = enabled;
      if (graph !== undefined) body.graph = graph;

      const result = await apiCall<{ data: unknown }>({
        method: 'PUT',
        path: `/api/v1/boards/${boardId}/state-transitions`,
        body,
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
    }
  );
}
