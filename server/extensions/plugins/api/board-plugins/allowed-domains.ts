// PATCH /api/v1/boards/:boardId/plugins/:pluginId/allowed-domains
// Sets allowedDomains for a specific plugin on a board (board admin only).
// allowedDomains must be null (unrestricted) or a subset of the plugin's whitelistedDomains.
import { db } from '../../../../common/db';
import { boardAdminGuard, type BoardAdminRequest } from '../../middlewares/board-admin-guard';

export async function handleSetBoardPluginAllowedDomains(
  req: Request,
  boardId: string,
  pluginId: string,
): Promise<Response> {
  const guardError = await boardAdminGuard(req as BoardAdminRequest, boardId);
  if (guardError) return guardError;

  let body: { allowedDomains?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  // Find the active board_plugins row.
  const boardPlugin = await db('board_plugins')
    .where({ board_id: boardId, plugin_id: pluginId })
    .whereNull('disabled_at')
    .first();

  if (!boardPlugin) {
    return Response.json(
      { error: { code: 'plugin-not-enabled', message: 'Plugin is not enabled on this board' } },
      { status: 404 },
    );
  }

  // Fetch the plugin's whitelisted domains.
  const plugin = await db('plugins').where({ id: pluginId }).first();
  if (!plugin) {
    return Response.json(
      { error: { code: 'plugin-not-found', message: 'Plugin not found' } },
      { status: 404 },
    );
  }

  const allowedDomains = body.allowedDomains ?? null;

  if (allowedDomains !== null) {
    if (!Array.isArray(allowedDomains)) {
      return Response.json(
        { error: { code: 'invalid-allowed-domains', message: 'allowedDomains must be an array or null' } },
        { status: 422 },
      );
    }

    const whitelistedDomains: string[] = Array.isArray(plugin.whitelisted_domains)
      ? plugin.whitelisted_domains
      : [];

    // Every allowed domain must be declared in the plugin's whitelistedDomains.
    for (const domain of allowedDomains) {
      if (!whitelistedDomains.includes(domain as string)) {
        return Response.json(
          {
            name: 'domain-not-whitelisted-by-plugin',
            data: { message: `'${domain}' is not in the plugin's whitelistedDomains` },
          },
          { status: 422 },
        );
      }
    }
  }

  // Merge allowedDomains into existing config (replace, not deep-merge).
  const existingConfig = boardPlugin.config ?? {};
  const newConfig = { ...existingConfig, allowedDomains };

  await db('board_plugins')
    .where({ id: boardPlugin.id })
    .update({ config: JSON.stringify(newConfig) });

  return Response.json({ data: { boardPluginId: boardPlugin.id, allowedDomains } });
}
