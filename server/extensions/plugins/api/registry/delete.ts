// DELETE /api/v1/plugins/:pluginId — soft-delete a plugin (set is_active=false, platform admin only).
// Does not remove the row; existing board_plugins entries remain but plugin cannot be newly enabled.
import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { platformAdminGuard } from '../../../../middlewares/platformAdminGuard';

export async function handleDeletePlugin(req: Request, pluginId: string): Promise<Response> {
  const guardError = await platformAdminGuard(req as AuthenticatedRequest);
  if (guardError) return guardError;

  const plugin = await db('plugins').where({ id: pluginId }).first();
  if (!plugin) {
    return Response.json(
      { name: 'plugin-not-found', data: { message: 'Plugin not found' } },
      { status: 404 },
    );
  }

  await db('plugins').where({ id: pluginId }).update({ is_active: false, updated_at: db.fn.now() });

  return Response.json({ data: {} });
}
