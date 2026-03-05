// GET /api/v1/plugins — list plugins from the registry.
// Non-admins: only is_public=true && is_active=true plugins.
// Workspace OWNER/ADMIN in any workspace: all plugins.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';

async function isRegistryAdmin(userId: string): Promise<boolean> {
  const row = await db('memberships')
    .where({ user_id: userId })
    .whereIn('role', ['OWNER', 'ADMIN'])
    .first();
  return !!row;
}

export async function handleListPlugins(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const currentUser = (req as AuthenticatedRequest).currentUser!;
  const admin = await isRegistryAdmin(currentUser.id);

  const query = db('plugins').orderBy('created_at', 'asc');

  if (!admin) {
    query.where({ is_public: true, is_active: true });
  }

  const plugins = await query.select(
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
    // api_key is never returned in list responses
  );

  return Response.json({ data: plugins });
}
