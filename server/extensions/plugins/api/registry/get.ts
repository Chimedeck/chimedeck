// GET /api/v1/plugins/:pluginId — fetch a single plugin by ID.
// Non-admins: only accessible if is_public=true && is_active=true.
// Workspace OWNER/ADMIN in any workspace: see any plugin.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { normalizePlugin } from '../../common/normalizePlugin';

async function isRegistryAdmin(userId: string): Promise<boolean> {
  const row = await db('memberships')
    .where({ user_id: userId })
    .whereIn('role', ['OWNER', 'ADMIN'])
    .first();
  return !!row;
}

export async function handleGetPlugin(req: Request, pluginId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const currentUser = (req as AuthenticatedRequest).currentUser!;
  const admin = await isRegistryAdmin(currentUser.id);

  const plugin = await db('plugins')
    .where({ id: pluginId })
    .select(
      'id',
      'name',
      'slug',
      'description',
      'icon_url',
      'connector_url',
      'manifest_url',
      'author',
      'author_email',
      'support_email',
      'categories',
      'capabilities',
      'is_public',
      'is_active',
      'created_at',
      'updated_at',
    )
    .first();

  if (!plugin) {
    return Response.json(
      { name: 'plugin-not-found', data: { message: 'Plugin not found' } },
      { status: 404 },
    );
  }

  if (!admin && (!plugin.is_public || !plugin.is_active)) {
    return Response.json(
      { name: 'plugin-not-found', data: { message: 'Plugin not found' } },
      { status: 404 },
    );
  }

  return Response.json({ data: normalizePlugin(plugin) });
}
