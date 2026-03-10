// GET /api/v1/plugins/data — reads a plugin-scoped key/value entry.
// Auth: Authorization: Bearer <plugin-token>  (short-lived JWT issued by /token endpoint)
// Query params: boardId, scope, resourceId, key, visibility, userId (required for private)
import { db } from '../../../../common/db';
import { resolvePluginToken } from '../../common/resolvePluginToken';
import {
  validateResourceBelongsToBoard,
  ResourceBoardMismatchError,
} from '../../common/validateResourceBelongsToBoard';

const VALID_SCOPES = ['card', 'list', 'board', 'member'] as const;
const VALID_VISIBILITY = ['private', 'shared'] as const;

type Scope = (typeof VALID_SCOPES)[number];
type Visibility = (typeof VALID_VISIBILITY)[number];

export async function handleGetPluginData(req: Request): Promise<Response> {
  const result = await resolvePluginToken(req);
  if (result instanceof Response) return result;
  const { plugin, claims } = result;

  const url = new URL(req.url);
  // boardId from token claims — the query param must match to prevent cross-board access.
  const boardIdParam = url.searchParams.get('boardId');
  const boardId = claims.boardId;
  const scope = url.searchParams.get('scope') as Scope | null;
  const resourceId = url.searchParams.get('resourceId');
  const key = url.searchParams.get('key');
  const visibility = (url.searchParams.get('visibility') ?? 'shared') as Visibility;
  const userId = url.searchParams.get('userId');

  if (boardIdParam && boardIdParam !== boardId) {
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
  if (!scope || !VALID_SCOPES.includes(scope)) {
    return Response.json(
      { error: { code: 'missing-param', message: 'scope must be one of: card, list, board, member' } },
      { status: 400 },
    );
  }
  if (!resourceId) {
    return Response.json(
      { error: { code: 'missing-param', message: 'resourceId is required' } },
      { status: 400 },
    );
  }
  if (!key) {
    return Response.json(
      { error: { code: 'missing-param', message: 'key is required' } },
      { status: 400 },
    );
  }
  if (!VALID_VISIBILITY.includes(visibility)) {
    return Response.json(
      { error: { code: 'missing-param', message: 'visibility must be private or shared' } },
      { status: 400 },
    );
  }
  if (visibility === 'private' && !userId) {
    return Response.json(
      { error: { code: 'missing-param', message: 'userId is required for private visibility' } },
      { status: 400 },
    );
  }

  try {
    await validateResourceBelongsToBoard(scope, resourceId, boardId);
  } catch (err) {
    if (err instanceof ResourceBoardMismatchError) {
      return Response.json(
        { error: { code: 'resource-board-mismatch', message: err.message } },
        { status: 403 },
      );
    }
    throw err;
  }

  const query = db('plugin_data').where({
    plugin_id: plugin.id,
    scope,
    resource_id: resourceId,
    board_id: boardId,
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
