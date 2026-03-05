// GET /api/v1/plugins — list plugins from the registry.
// Non-admins: only is_public=true && is_active=true plugins.
// Workspace OWNER/ADMIN in any workspace: all active plugins.
// Supports: q (ILIKE search), category (JSONB contains), isPublic (boolean), page, perPage (max 50).
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

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const category = url.searchParams.get('category')?.trim() ?? '';
  const isPublicParam = url.searchParams.get('isPublic');
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') ?? '20', 10)));

  // Soft-deleted plugins are always excluded from list results.
  const query = db('plugins').where({ is_active: true });

  if (!admin) {
    query.where({ is_public: true });
  }

  if (q) {
    query.where((builder) => {
      builder
        .whereRaw('name ILIKE ?', [`%${q}%`])
        .orWhereRaw('description ILIKE ?', [`%${q}%`])
        .orWhereRaw('author ILIKE ?', [`%${q}%`]);
    });
  }

  if (category) {
    // JSONB array contains the given category string.
    query.whereRaw('categories @> ?::jsonb', [JSON.stringify([category])]);
  }

  if (isPublicParam !== null) {
    query.where({ is_public: isPublicParam === 'true' });
  }

  const countResult = await query.clone().count('id as count').first();
  const total = parseInt(String((countResult as any)?.count ?? '0'), 10);
  const totalPage = Math.ceil(total / perPage);

  const plugins = await query
    .orderBy('created_at', 'asc')
    .limit(perPage)
    .offset((page - 1) * perPage)
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
      // api_key is never returned in list responses
    );

  const normalised = plugins.map((p: any) => ({
    ...p,
    capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
  }));

  return Response.json({
    data: normalised,
    metadata: { total, totalPage, page, perPage },
  });
}
