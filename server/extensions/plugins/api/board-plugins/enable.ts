// POST /api/v1/boards/:boardId/plugins — enable a plugin for a board (board admin only).
// Creates a board_plugins row (or re-enables a previously disabled one).
// Returns plugin metadata. Errors if plugin not active in registry or already enabled.
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import { boardAdminGuard, type BoardAdminRequest } from '../../middlewares/board-admin-guard';

export async function handleEnableBoardPlugin(req: Request, boardId: string): Promise<Response> {
  const guardError = await boardAdminGuard(req as BoardAdminRequest, boardId);
  if (guardError) return guardError;

  let body: { pluginId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.pluginId || typeof body.pluginId !== 'string') {
    return Response.json(
      { name: 'bad-request', data: { message: 'pluginId is required' } },
      { status: 400 },
    );
  }

  const plugin = await db('plugins').where({ id: body.pluginId }).first();
  if (!plugin || !plugin.is_active) {
    return Response.json(
      { name: 'plugin-not-active', data: { message: 'Plugin not found or not active in registry' } },
      { status: 404 },
    );
  }

  const existing = await db('board_plugins')
    .where({ board_id: boardId, plugin_id: body.pluginId })
    .first();

  if (existing && !existing.disabled_at) {
    return Response.json(
      { name: 'plugin-already-enabled', data: { message: 'Plugin is already enabled on this board' } },
      { status: 409 },
    );
  }

  const currentUserId = (req as BoardAdminRequest).currentUser!.id;

  if (existing && existing.disabled_at) {
    // Re-enable: clear disabled_at and update enabled_by/enabled_at.
    await db('board_plugins')
      .where({ id: existing.id })
      .update({ disabled_at: null, enabled_by: currentUserId, enabled_at: db.fn.now() });
  } else {
    await db('board_plugins').insert({
      id: randomUUID(),
      board_id: boardId,
      plugin_id: body.pluginId,
      enabled_by: currentUserId,
      enabled_at: db.fn.now(),
    });
  }

  return Response.json({
    data: {
      id: plugin.id,
      name: plugin.name,
      slug: plugin.slug,
      description: plugin.description,
      icon_url: plugin.icon_url,
      connector_url: plugin.connector_url,
      author: plugin.author,
      categories: plugin.categories,
      capabilities: plugin.capabilities,
    },
  }, { status: 201 });
}
