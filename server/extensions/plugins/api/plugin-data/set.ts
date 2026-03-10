// PUT /api/v1/plugins/data — upserts a plugin-scoped key/value entry.
// Auth: Authorization: Bearer <plugin-token>  (short-lived JWT issued by /token endpoint)
// Body: { boardId, scope, resourceId, key, visibility, value, userId? (required for private) }
import { db } from '../../../../common/db';
import { randomUUID } from 'node:crypto';
import { resolvePluginToken } from '../../common/resolvePluginToken';
import {
  validateResourceBelongsToBoard,
  ResourceBoardMismatchError,
} from '../../common/validateResourceBelongsToBoard';

const VALID_SCOPES = ['card', 'list', 'board', 'member'] as const;
const VALID_VISIBILITY = ['private', 'shared'] as const;

type Scope = (typeof VALID_SCOPES)[number];
type Visibility = (typeof VALID_VISIBILITY)[number];

export async function handleSetPluginData(req: Request): Promise<Response> {
  const result = await resolvePluginToken(req);
  if (result instanceof Response) return result;
  const { plugin, claims } = result;

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
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { boardId: boardIdBody, scope, resourceId, key, visibility = 'shared', value, userId } = body;

  // boardId is sourced from the token claims — the body param must match if provided.
  const boardId = claims.boardId;

  if (boardIdBody && typeof boardIdBody === 'string' && boardIdBody !== boardId) {
    return Response.json(
      { error: { code: 'forbidden', message: 'boardId does not match token scope' } },
      { status: 403 },
    );
  }

  if (!boardId) {
    return Response.json(
      { error: { code: 'missing-param', message: 'boardId is required' } },
      { status: 400 },
    );
  }
  if (!scope || !VALID_SCOPES.includes(scope as Scope)) {
    return Response.json(
      { error: { code: 'missing-param', message: 'scope must be one of: card, list, board, member' } },
      { status: 400 },
    );
  }
  if (!resourceId || typeof resourceId !== 'string') {
    return Response.json(
      { error: { code: 'missing-param', message: 'resourceId is required' } },
      { status: 400 },
    );
  }
  if (!key || typeof key !== 'string') {
    return Response.json(
      { error: { code: 'missing-param', message: 'key is required' } },
      { status: 400 },
    );
  }
  if (!VALID_VISIBILITY.includes(visibility as Visibility)) {
    return Response.json(
      { error: { code: 'missing-param', message: 'visibility must be private or shared' } },
      { status: 400 },
    );
  }
  if (visibility === 'private' && (!userId || typeof userId !== 'string')) {
    return Response.json(
      { error: { code: 'missing-param', message: 'userId is required for private visibility' } },
      { status: 400 },
    );
  }

  const resolvedUserId = visibility === 'private' ? (userId as string) : null;

  try {
    await validateResourceBelongsToBoard(scope as 'card' | 'list' | 'board' | 'member', resourceId, boardId);
  } catch (err) {
    if (err instanceof ResourceBoardMismatchError) {
      return Response.json(
        { error: { code: 'resource-board-mismatch', message: err.message } },
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

  if (resolvedUserId === null) {
    existingQuery.whereNull('user_id');
  } else {
    existingQuery.where('user_id', resolvedUserId);
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
