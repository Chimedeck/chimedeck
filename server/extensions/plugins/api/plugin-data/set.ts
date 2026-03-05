// PUT /api/v1/plugins/data — upserts a plugin-scoped key/value entry.
// Auth: Authorization: ApiKey <key>  (identifies the calling plugin)
// Body: { boardId, scope, resourceId, key, visibility, value, userId? (required for private) }
import { db } from '../../../../common/db';
import { randomUUID } from 'crypto';
import {
  validateResourceBelongsToBoard,
  ResourceBoardMismatchError,
} from '../../common/validateResourceBelongsToBoard';

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

export async function handleSetPluginData(req: Request): Promise<Response> {
  const result = await resolvePlugin(req);
  if (result instanceof Response) return result;
  const { plugin } = result;

  let body: {
    boardId?: unknown;
    scope?: unknown;
    resourceId?: unknown;
    key?: unknown;
    visibility?: unknown;
    value?: unknown;
    userId?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { boardId, scope, resourceId, key, visibility = 'shared', value, userId } = body;

  if (!boardId || typeof boardId !== 'string') {
    return Response.json(
      { name: 'missing-param', data: { message: 'boardId is required' } },
      { status: 400 },
    );
  }
  if (!scope || !VALID_SCOPES.includes(scope as Scope)) {
    return Response.json(
      { name: 'missing-param', data: { message: 'scope must be one of: card, list, board, member' } },
      { status: 400 },
    );
  }
  if (!resourceId || typeof resourceId !== 'string') {
    return Response.json(
      { name: 'missing-param', data: { message: 'resourceId is required' } },
      { status: 400 },
    );
  }
  if (!key || typeof key !== 'string') {
    return Response.json(
      { name: 'missing-param', data: { message: 'key is required' } },
      { status: 400 },
    );
  }
  if (!VALID_VISIBILITY.includes(visibility as Visibility)) {
    return Response.json(
      { name: 'missing-param', data: { message: 'visibility must be private or shared' } },
      { status: 400 },
    );
  }
  if (visibility === 'private' && (!userId || typeof userId !== 'string')) {
    return Response.json(
      { name: 'missing-param', data: { message: 'userId is required for private visibility' } },
      { status: 400 },
    );
  }

  const resolvedUserId = visibility === 'private' ? (userId as string) : null;

  try {
    await validateResourceBelongsToBoard(scope as 'card' | 'list' | 'board' | 'member', resourceId, boardId);
  } catch (err) {
    if (err instanceof ResourceBoardMismatchError) {
      return Response.json(
        { name: 'resource-board-mismatch', data: { message: err.message } },
        { status: 403 },
      );
    }
    throw err;
  }

  // Check for existing row; PostgreSQL UNIQUE constraint with nullable user_id/board_id
  // requires a manual select-then-insert/update approach.
  const existingQuery = db('plugin_data').where({
    plugin_id: plugin.id,
    scope: scope as string,
    resource_id: resourceId,
    board_id: boardId,
    key,
  });

  if (resolvedUserId !== null) {
    existingQuery.where('user_id', resolvedUserId);
  } else {
    existingQuery.whereNull('user_id');
  }

  const existing = await existingQuery.first();

  if (existing) {
    await db('plugin_data')
      .where({ id: existing.id })
      .update({ value: JSON.stringify(value) });
  } else {
    await db('plugin_data').insert({
      id: randomUUID(),
      plugin_id: plugin.id,
      scope: scope as string,
      resource_id: resourceId,
      board_id: boardId,
      user_id: resolvedUserId,
      key,
      value: JSON.stringify(value),
    });
  }

  return Response.json({ data: null }, { status: 200 });
}
