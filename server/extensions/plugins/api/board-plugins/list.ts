// GET /api/v1/boards/:boardId/plugins — list active plugins for a board.
// Returns only plugins where disabled_at IS NULL, joined with plugin metadata.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';

type BoardRow = { workspace_id: string };

type BoardPluginJoinRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  connector_url: string | null;
  manifest_url: string | null;
  author: string | null;
  author_email: string | null;
  support_email: string | null;
  categories: unknown;
  capabilities: unknown;
  whitelisted_domains: unknown;
  is_public: boolean;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  board_plugin_id: string;
  enabled_at: string | Date;
  config: unknown;
};

export async function handleListBoardPlugins(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = (await db('boards').where({ id: boardId }).first()) as BoardRow | undefined;
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  // Join board_plugins with plugins to return full plugin metadata for active entries only.
  const rows = (await db('board_plugins as bp')
    .join('plugins as p', 'p.id', 'bp.plugin_id')
    .where('bp.board_id', boardId)
    .whereNull('bp.disabled_at')
    .select(
      'p.id',
      'p.api_key',
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
    )) as BoardPluginJoinRow[];

  // Reshape flat join rows into the BoardPlugin shape the client expects:
  // { id, boardId, plugin: Plugin, enabledAt, disabledAt, config }
  const boardPlugins = rows.map((row) => ({
    id: row.board_plugin_id,
    boardId: boardId,
    plugin: {
      id: row.id,
      // api_key is the server-side HMAC secret used to sign plugin tokens — never expose it.
      name: row.name,
      slug: row.slug,
      description: row.description,
      iconUrl: row.icon_url ?? null,
      connectorUrl: row.connector_url,
      manifestUrl: row.manifest_url ?? null,
      author: row.author ?? null,
      authorEmail: row.author_email ?? null,
      supportEmail: row.support_email ?? null,
      categories: row.categories ?? [],
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
      whitelistedDomains: Array.isArray(row.whitelisted_domains) ? row.whitelisted_domains : [],
      isPublic: row.is_public,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    enabledAt: row.enabled_at,
    disabledAt: null,
    config: row.config ?? {},
  }));

  return Response.json({ data: boardPlugins });
}
