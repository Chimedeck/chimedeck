// PATCH /api/v1/plugins/:pluginId — partially update plugin metadata (platform admin only).
// All fields are optional; only provided fields are updated.
import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { platformAdminGuard } from '../../../../middlewares/platformAdminGuard';
import { isValidHttpsOrigin } from '../../common/isValidHttpsOrigin';
import { normalizePlugin } from '../../common/normalizePlugin';

const MAX_WHITELISTED_DOMAINS = 20;

export async function handleUpdatePlugin(req: Request, pluginId: string): Promise<Response> {
  const guardError = await platformAdminGuard(req as AuthenticatedRequest);
  if (guardError) return guardError;

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
  if (body.categories !== undefined) updates.categories = Array.isArray(body.categories) ? body.categories : [];
  if (body.isPublic !== undefined) updates.is_public = body.isPublic;
  if (body.capabilities !== undefined) updates.capabilities = JSON.stringify(body.capabilities);

  if (body.whitelistedDomains !== undefined) {
    const rawDomains = body.whitelistedDomains;
    if (!Array.isArray(rawDomains)) {
      return Response.json(
        { name: 'invalid-whitelisted-domains', data: { message: 'whitelistedDomains must be an array' } },
        { status: 422 },
      );
    }
    if (rawDomains.length > MAX_WHITELISTED_DOMAINS) {
      return Response.json(
        { name: 'too-many-whitelisted-domains', data: { message: `whitelistedDomains may contain at most ${MAX_WHITELISTED_DOMAINS} entries` } },
        { status: 422 },
      );
    }
    for (const domain of rawDomains) {
      if (typeof domain !== 'string' || !isValidHttpsOrigin(domain)) {
        return Response.json(
          { name: 'invalid-whitelisted-domain', data: { message: `'${domain}' is not a valid HTTPS origin` } },
          { status: 422 },
        );
      }
    }
    // [why] whitelisted_domains is a native text[] column — pass the array
    // directly so the pg driver serialises it as a PG array, not a JSON string.
    updates.whitelisted_domains = rawDomains;
  }

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
      'whitelisted_domains',
      'is_public',
      'is_active',
      'created_at',
      'updated_at',
    )
    .first();

  const normalisedUpdated = updated ? normalizePlugin(updated) : updated;

  return Response.json({ data: normalisedUpdated });
}
