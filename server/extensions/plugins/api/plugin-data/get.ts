// GET /api/v1/plugins/data — reads a plugin-scoped key/value entry.
// Auth: Authorization: ApiKey <key>  (identifies the calling plugin)
// Query params: scope, resourceId, key, visibility, userId (required for private)
import { db } from '../../../../common/db';

const VALID_SCOPES = ['card', 'list', 'board', 'member'] as const;
const VALID_VISIBILITY = ['private', 'shared'] as const;

type Scope = (typeof VALID_SCOPES)[number];
type Visibility = (typeof VALID_VISIBILITY)[number];

async function resolvePlugin(req: Request): Promise<{ plugin: Record<string, unknown> } | Response> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^ApiKey\s+(.+)$/i);
  if (!match) {
    return Response.json(
      { name: 'invalid-api-key', data: { message: 'Authorization: ApiKey <key> header required' } },
      { status: 401 },
    );
  }
  const apiKey = (match[1] ?? '').trim();
  const plugin = await db('plugins').where({ api_key: apiKey }).first();
  if (!plugin || !plugin.is_active) {
    return Response.json(
      { name: 'invalid-api-key', data: { message: 'Invalid or inactive plugin API key' } },
      { status: 401 },
    );
  }
  return { plugin };
}

export async function handleGetPluginData(req: Request): Promise<Response> {
  const result = await resolvePlugin(req);
  if (result instanceof Response) return result;
  const { plugin } = result;

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') as Scope | null;
  const resourceId = url.searchParams.get('resourceId');
  const key = url.searchParams.get('key');
  const visibility = (url.searchParams.get('visibility') ?? 'shared') as Visibility;
  const userId = url.searchParams.get('userId');

  if (!scope || !VALID_SCOPES.includes(scope)) {
    return Response.json(
      { name: 'missing-param', data: { message: 'scope must be one of: card, list, board, member' } },
      { status: 400 },
    );
  }
  if (!resourceId) {
    return Response.json(
      { name: 'missing-param', data: { message: 'resourceId is required' } },
      { status: 400 },
    );
  }
  if (!key) {
    return Response.json(
      { name: 'missing-param', data: { message: 'key is required' } },
      { status: 400 },
    );
  }
  if (!VALID_VISIBILITY.includes(visibility)) {
    return Response.json(
      { name: 'missing-param', data: { message: 'visibility must be private or shared' } },
      { status: 400 },
    );
  }
  if (visibility === 'private' && !userId) {
    return Response.json(
      { name: 'missing-param', data: { message: 'userId is required for private visibility' } },
      { status: 400 },
    );
  }

  const query = db('plugin_data').where({
    plugin_id: plugin.id,
    scope,
    resource_id: resourceId,
    key,
  });

  if (visibility === 'private') {
    query.where('user_id', userId!);
  } else {
    query.whereNull('user_id');
  }

  const row = await query.first();
  return Response.json({ data: row ? row.value : null });
}
