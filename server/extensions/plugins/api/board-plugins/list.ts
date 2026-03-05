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
      'p.author_email',
      'p.support_email',
      'p.manifest_url',
      'p.icon_url',
      'p.categories',
      'p.capabilities',
      'p.whitelisted_domains',
      'p.is_public',
      'p.is_active',
      'p.created_at',
      'p.updated_at',
      'bp.id as board_plugin_id',
      'bp.enabled_at',
      'bp.config',
    );

  // Reshape flat join rows into the BoardPlugin shape the client expects:
  // { id, boardId, plugin: Plugin, enabledAt, disabledAt, config }
  const boardPlugins = rows.map((r: any) => ({
    id: r.board_plugin_id,
    boardId: boardId,
    plugin: {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      iconUrl: r.icon_url ?? null,
      connectorUrl: r.connector_url,
      manifestUrl: r.manifest_url ?? null,
      author: r.author ?? null,
      authorEmail: r.author_email ?? null,
      supportEmail: r.support_email ?? null,
      categories: r.categories ?? [],
      capabilities: Array.isArray(r.capabilities) ? r.capabilities : [],
      whitelistedDomains: Array.isArray(r.whitelisted_domains) ? r.whitelisted_domains : [],
      isPublic: r.is_public,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    },
    enabledAt: r.enabled_at,
    disabledAt: null,
    config: r.config ?? {},
  }));

  return Response.json({ data: boardPlugins });
}
