// GET /api/v1/boards/:boardId/plugins — list active plugins for a board.
// Returns only plugins where disabled_at IS NULL, joined with plugin metadata.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';

export async function handleListBoardPlugins(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  // Join board_plugins with plugins to return full plugin metadata for active entries only.
  const rows = await db('board_plugins as bp')
    .join('plugins as p', 'p.id', 'bp.plugin_id')
    .where('bp.board_id', boardId)
    .whereNull('bp.disabled_at')
    .select(
      'p.id',
      'p.name',
      'p.slug',
      'p.description',
      'p.icon_url',
      'p.connector_url',
      'p.author',
      'p.categories',
      'p.capabilities',
      'bp.id as board_plugin_id',
      'bp.enabled_at',
      'bp.config',
    );

  return Response.json({ data: rows });
}
