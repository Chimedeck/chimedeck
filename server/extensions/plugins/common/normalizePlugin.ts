// Converts a raw DB plugin row (snake_case) to the camelCase shape the client expects.
// [why] Knex returns column names exactly as they appear in Postgres (snake_case).
// All registry endpoints must pass rows through this function before returning
// responses so the shape stays in sync with the client's Plugin interface.
export function normalizePlugin(p: Record<string, unknown>): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    iconUrl: p.icon_url ?? null,
    connectorUrl: p.connector_url,
    manifestUrl: p.manifest_url ?? null,
    author: p.author ?? null,
    authorEmail: p.author_email ?? null,
    supportEmail: p.support_email ?? null,
    categories: Array.isArray(p.categories) ? p.categories : [],
    capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
    whitelistedDomains: Array.isArray(p.whitelisted_domains) ? p.whitelisted_domains : [],
    isPublic: p.is_public,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}
