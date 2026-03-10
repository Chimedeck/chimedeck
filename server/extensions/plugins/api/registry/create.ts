// POST /api/v1/plugins — register a new plugin in the registry (platform admin only).
// Generates an api_key (randomUUID), fetches and caches capabilities from manifestUrl.
// Returns the full plugin record including api_key (only returned on creation).
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { platformAdminGuard } from '../../../../middlewares/platformAdminGuard';
import { isValidHttpsOrigin } from '../../common/isValidHttpsOrigin';
import { normalizePlugin } from '../../common/normalizePlugin';

const MAX_WHITELISTED_DOMAINS = 20;

async function fetchManifestCapabilities(manifestUrl: string): Promise<string[] | null> {
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
    whitelistedDomains?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  const { name, slug, description, iconUrl, connectorUrl, manifestUrl } = body;

  if (!name || typeof name !== 'string') {
    return Response.json(
      { error: { code: 'missing-param', message: 'name is required' } },
      { status: 400 }
    );
  }
  if (!slug || typeof slug !== 'string') {
    return Response.json(
      { error: { code: 'missing-param', message: 'slug is required' } },
      { status: 400 }
    );
  }
  if (!connectorUrl || typeof connectorUrl !== 'string') {
    return Response.json(
      { error: { code: 'missing-param', message: 'connectorUrl is required' } },
      { status: 400 }
    );
  }

  if (!connectorUrl.startsWith('https://')) {
    return Response.json(
      { error: { code: 'invalid-connector-url', message: 'connectorUrl must start with https://' } },
      { status: 422 }
    );
  }

  // Validate whitelistedDomains if provided.
  const rawDomains = body.whitelistedDomains;
  let whitelistedDomains: string[] = [];
  if (rawDomains !== undefined && rawDomains !== null) {
    if (!Array.isArray(rawDomains)) {
      return Response.json(
        {
          name: 'invalid-whitelisted-domains',
          data: { message: 'whitelistedDomains must be an array' },
        },
        { status: 422 }
      );
    }
    if (rawDomains.length > MAX_WHITELISTED_DOMAINS) {
      return Response.json(
        {
          name: 'too-many-whitelisted-domains',
          data: {
            message: `whitelistedDomains may contain at most ${MAX_WHITELISTED_DOMAINS} entries`,
          },
        },
        { status: 422 }
      );
    }
    for (const domain of rawDomains) {
      if (typeof domain !== 'string' || !isValidHttpsOrigin(domain)) {
        return Response.json(
          {
            name: 'invalid-whitelisted-domain',
            data: { message: `'${domain}' is not a valid HTTPS origin` },
          },
          { status: 422 }
        );
      }
    }
    whitelistedDomains = rawDomains as string[];
  }

  // Ensure slug is unique.
  const existing = await db('plugins').where({ slug }).first();
  if (existing) {
    return Response.json(
      {
        name: 'plugin-slug-taken',
        data: { message: `A plugin with slug '${slug}' already exists` },
      },
      { status: 409 }
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
    // [why] whitelisted_domains is a native text[] column — pass the array
    // directly so the pg driver serialises it as a PG array, not a JSON string.
    whitelisted_domains: whitelistedDomains,
    created_at: now,
    updated_at: now,
  });

  const plugin = await db('plugins').where({ id }).first();

  // api_key is only returned on creation — merge into normalised shape.
  return Response.json({ data: { ...normalizePlugin(plugin), apiKey } }, { status: 201 });
}
