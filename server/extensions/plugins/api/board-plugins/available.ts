// GET /api/v1/boards/:boardId/plugins/available
// Returns globally active plugins (is_active = true) that are NOT currently enabled on this board.
// A plugin is "currently enabled" when a board_plugins row exists with disabled_at IS NULL.
// Plugins that were previously disabled (disabled_at IS NOT NULL) re-appear as available.
// Auth: board member. Query params: q (ILIKE on name/description/author), category.
import { db } from '../../../../common/db';
import { boardMemberGuard, type BoardAdminRequest } from '../../middlewares/board-admin-guard';
import { normalizePlugin } from '../../common/normalizePlugin';

export async function handleListAvailableBoardPlugins(
  req: Request,
  boardId: string,
): Promise<Response> {
  // boardMemberGuard handles auth + board-not-found (returns 403/404 on failure).
  const guardError = await boardMemberGuard(req as BoardAdminRequest, boardId);
  if (guardError) return guardError;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const category = url.searchParams.get('category')?.trim() ?? '';

  // Base: only globally active plugins.
  const query = db('plugins').where({ is_active: true });

  // Exclude plugins that are currently enabled on this board (disabled_at IS NULL).
  // [why] whereNotExists keeps the query composable and avoids a subquery join blowup.
  query.whereNotExists(
    db('board_plugins')
      .where('board_plugins.board_id', boardId)
      .whereRaw('board_plugins.plugin_id = plugins.id')
      .whereNull('board_plugins.disabled_at')
      .select(db.raw('1')),
  );

  if (q) {
    query.where((builder) => {
      builder
        .whereRaw('plugins.name ILIKE ?', [`%${q}%`])
        .orWhereRaw('plugins.description ILIKE ?', [`%${q}%`])
        .orWhereRaw('plugins.author ILIKE ?', [`%${q}%`]);
    });
  }

  if (category) {
    // JSONB array contains the given category string.
    query.whereRaw('plugins.categories @> ?::jsonb', [JSON.stringify([category])]);
  }

  const countResult = await query.clone().count('plugins.id as count').first();
  const total = parseInt(String((countResult as any)?.count ?? '0'), 10);

  const rows = await query
    .orderBy('plugins.created_at', 'asc')
    .select(
      'plugins.id',
      'plugins.name',
      'plugins.slug',
      'plugins.description',
      'plugins.icon_url',
      'plugins.connector_url',
      'plugins.manifest_url',
      'plugins.author',
      'plugins.author_email',
      'plugins.support_email',
      'plugins.categories',
      'plugins.capabilities',
      'plugins.whitelisted_domains',
      'plugins.is_public',
      'plugins.is_active',
      'plugins.created_at',
      'plugins.updated_at',
      // api_key is never returned to clients
    );

  return Response.json({
    data: rows.map((p: any) => normalizePlugin(p)),
    metadata: { total },
  });
}
