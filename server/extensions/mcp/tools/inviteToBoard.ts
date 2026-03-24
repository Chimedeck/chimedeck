import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiCall } from '../apiClient';

export function registerInviteToBoard(server: McpServer, token: string): void {
  server.tool(
    'invite_to_board',
    'Invite a user to a board by email. Requires the token holder to be a board admin.',
    {
      boardId: z.string().describe('ID of the board to invite the user to'),
      email: z.string().email().describe('Email address of the user to invite'),
      role: z
        .enum(['member', 'observer'])
        .optional()
        .describe('Role to assign; defaults to "member"'),
    },
    async ({ boardId, email, role }) => {
      const result = await apiCall<{ data: unknown }>({
        method: 'POST',
        path: `/api/v1/boards/${boardId}/members`,
        body: { email, role },
        token,
      });

      if ('error' in result) {
        // Surface structured error (e.g. current-user-is-not-admin) without crashing
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: result.error }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result.data) }],
      };
    },
  );
}
