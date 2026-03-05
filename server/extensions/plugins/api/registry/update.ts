// PATCH /api/v1/plugins/:pluginId — partially update plugin metadata (admin only).
// All fields are optional; only provided fields are updated.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';

async function isRegistryAdmin(userId: string): Promise<boolean> {
  const row = await db('memberships')
    .where({ user_id: userId })
    .whereIn('role', ['OWNER', 'ADMIN'])
    .first();
  return !!row;
}

export async function handleUpdatePlugin(req: Request, pluginId: string): Promise<Response> {
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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updated_at: db.fn.now() };

  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.iconUrl !== undefined) updates.icon_url = body.iconUrl;
  if (body.connectorUrl !== undefined) updates.connector_url = body.connectorUrl;
  if (body.manifestUrl !== undefined) updates.manifest_url = body.manifestUrl;
  if (body.author !== undefined) updates.author = body.author;
  if (body.authorEmail !== undefined) updates.author_email = body.authorEmail;
  if (body.supportEmail !== undefined) updates.support_email = body.supportEmail;
  if (body.categories !== undefined) updates.categories = JSON.stringify(body.categories);
  if (body.isPublic !== undefined) updates.is_public = body.isPublic;
  if (body.capabilities !== undefined) updates.capabilities = JSON.stringify(body.capabilities);

  await db('plugins').where({ id: pluginId }).update(updates);

  const updated = await db('plugins')
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

  return Response.json({ data: updated });
}
