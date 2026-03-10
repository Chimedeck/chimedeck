// DELETE /api/v1/boards/:boardId/plugins/:pluginId — soft-disable a plugin for a board (board admin only).
// Sets disabled_at on the board_plugins row; the row is NOT deleted.
import { db } from '../../../../common/db';
import { boardAdminGuard, type BoardAdminRequest } from '../../middlewares/board-admin-guard';

export async function handleDisableBoardPlugin(
  req: Request,
  boardId: string,
  pluginId: string,
): Promise<Response> {
  const guardError = await boardAdminGuard(req as BoardAdminRequest, boardId);
  if (guardError) return guardError;

  const row = await db('board_plugins')
    .where({ board_id: boardId, plugin_id: pluginId })
    .first();

  if (!row || row.disabled_at) {
    return Response.json(
      { error: { code: 'plugin-not-enabled', message: 'Plugin is not currently enabled on this board' } },
      { status: 404 },
    );
  }

  await db('board_plugins')
    .where({ id: row.id })
    .update({ disabled_at: db.fn.now() });

  return Response.json({ data: {} });
}
