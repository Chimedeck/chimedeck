// POST /api/v1/plugins — register a new plugin in the registry (platform admin only).
// Generates an api_key (randomUUID), fetches and caches capabilities from manifestUrl.
// Returns the full plugin record including api_key (only returned on creation).
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { platformAdminGuard } from '../../../../middlewares/platformAdminGuard';

async function fetchManifestCapabilities(
  manifestUrl: string,
): Promise<string[] | null> {
  try {
    const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { capabilities?: unknown };
    const caps = json.capabilities;
    return Array.isArray(caps) ? (caps as string[]) : null;
  } catch {
    // On failure (timeout, network error, invalid JSON), return null — allow registration with empty capabilities.
    return null;
  }
}

export async function handleCreatePlugin(req: Request): Promise<Response> {
  const guardError = await platformAdminGuard(req as AuthenticatedRequest);
  if (guardError) return guardError;

  const currentUser = (req as AuthenticatedRequest).currentUser!;

  let body: {
    name?: unknown;
    slug?: unknown;
    description?: unknown;
    iconUrl?: unknown;
    connectorUrl?: unknown;
    manifestUrl?: unknown;
    author?: unknown;
    authorEmail?: unknown;
    supportEmail?: unknown;
    categories?: unknown;
    isPublic?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { name, slug, description, iconUrl, connectorUrl, manifestUrl } = body;

  if (!name || typeof name !== 'string') {
    return Response.json(
      { name: 'missing-param', data: { message: 'name is required' } },
      { status: 400 },
    );
  }
  if (!slug || typeof slug !== 'string') {
    return Response.json(
      { name: 'missing-param', data: { message: 'slug is required' } },
      { status: 400 },
    );
  }
  if (!connectorUrl || typeof connectorUrl !== 'string') {
    return Response.json(
      { name: 'missing-param', data: { message: 'connectorUrl is required' } },
      { status: 400 },
    );
  }

  if (!connectorUrl.startsWith('https://')) {
    return Response.json(
      { name: 'invalid-connector-url', data: { message: 'connectorUrl must start with https://' } },
      { status: 422 },
    );
  }

  // Ensure slug is unique.
  const existing = await db('plugins').where({ slug }).first();
  if (existing) {
    return Response.json(
      { name: 'plugin-slug-taken', data: { message: `A plugin with slug '${slug}' already exists` } },
      { status: 409 },
    );
  }

  // Fetch and cache capabilities from the manifest (fail-open on errors).
  const capabilities =
    manifestUrl && typeof manifestUrl === 'string'
      ? await fetchManifestCapabilities(manifestUrl)
      : null;

  const apiKey = randomUUID();
  const id = randomUUID();
  const now = db.fn.now();

  await db('plugins').insert({
    id,
    name: name as string,
    slug: slug as string,
    description: description && typeof description === 'string' ? description : null,
    icon_url: iconUrl && typeof iconUrl === 'string' ? iconUrl : null,
    connector_url: connectorUrl as string,
    manifest_url: manifestUrl && typeof manifestUrl === 'string' ? manifestUrl : null,
    author: body.author && typeof body.author === 'string' ? body.author : null,
    author_email:
      body.authorEmail && typeof body.authorEmail === 'string' ? body.authorEmail : null,
    support_email:
      body.supportEmail && typeof body.supportEmail === 'string' ? body.supportEmail : null,
    categories: Array.isArray(body.categories) ? body.categories : [],
    capabilities: JSON.stringify(capabilities ?? []),
    is_public: body.isPublic === true,
    is_active: true,
    api_key: apiKey,
    created_at: now,
    updated_at: now,
  });

  const plugin = await db('plugins').where({ id }).first();

  // api_key is only returned on creation.
  return Response.json(
    {
      data: {
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        description: plugin.description,
        icon_url: plugin.icon_url,
        connector_url: plugin.connector_url,
        manifest_url: plugin.manifest_url,
        author: plugin.author,
        author_email: plugin.author_email,
        support_email: plugin.support_email,
        categories: plugin.categories,
        capabilities: Array.isArray(plugin.capabilities) ? plugin.capabilities : [],
        is_public: plugin.is_public,
        is_active: plugin.is_active,
        api_key: apiKey,
        created_at: plugin.created_at,
        updated_at: plugin.updated_at,
      },
    },
    { status: 201 },
  );
}
