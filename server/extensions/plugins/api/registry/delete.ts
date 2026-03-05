// DELETE /api/v1/plugins/:pluginId — soft-delete a plugin (set is_active=false, admin only).
// Does not remove the row; existing board_plugins entries remain but plugin cannot be newly enabled.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';

async function isRegistryAdmin(userId: string): Promise<boolean> {
  const row = await db('memberships')
    .where({ user_id: userId })
    .whereIn('role', ['OWNER', 'ADMIN'])
    .first();
  return !!row;
}

export async function handleDeletePlugin(req: Request, pluginId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const currentUser = (req as AuthenticatedRequest).currentUser!;
  const admin = await isRegistryAdmin(currentUser.id);

  if (!admin) {
    return Response.json(
      { name: 'not-platform-admin', data: { message: 'Platform admin access required' } },
      { status: 403 },
    );
  }

  const plugin = await db('plugins').where({ id: pluginId }).first();
  if (!plugin) {
    return Response.json(
      { name: 'plugin-not-found', data: { message: 'Plugin not found' } },
      { status: 404 },
    );
  }

  await db('plugins').where({ id: pluginId }).update({ is_active: false, updated_at: db.fn.now() });

  return Response.json({ data: null });
}
