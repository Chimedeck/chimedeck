import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerCopyStateTransitions(server: McpServer, token: string): void {
  server.tool(
    'copy_state_transitions',
    'Copy state transition graph from one board to another.',
    {
      boardId: z.string().describe('ID of the source board'),
      targetBoardId: z.string().describe('ID of the target board'),
      copyEnabled: z.boolean().optional().describe('Copy enabled flag from source board when true'),
    },
    async ({ boardId, targetBoardId, copyEnabled }) => {
      const body: Record<string, unknown> = { targetBoardId };
      if (copyEnabled !== undefined) body.copyEnabled = copyEnabled;

      const result = await apiCall<{ data: unknown }>({
        method: 'POST',
        path: `/api/v1/boards/${boardId}/state-transitions/copy`,
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
    },
  );
}
