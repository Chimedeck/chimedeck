// POST /api/v1/boards/:boardId/plugins/:pluginId/trello-token
// Issues a short-lived JWT token for Trello-compatible API access.
// Used by plugin iframes via the API_AUTHORIZE / API_GET_TOKEN / API_REQUEST messages.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { issueTrelloCompatToken } from '../../../auth/mods/token/trelloCompatToken';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';

interface BoardRow {
  id: string;
  workspace_id: string;
}

interface ActivePluginRow {
  id: string;
}

export async function handleGetTrelloCompatToken(
  req: Request,
  boardId: string,
  pluginId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authedReq = req as AuthenticatedRequest;
  const currentUser = authedReq.currentUser;
  if (!currentUser) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Must be authenticated' } },
      { status: 401 },
    );
  }

  const board = (await db('boards').where({ id: boardId }).first()) as BoardRow | undefined;
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const membershipError = await requireWorkspaceMembership(
    req as WorkspaceScopedRequest,
    board.workspace_id,
  );
  if (membershipError) return membershipError;

  // Verify plugin is active on this board.
  const boardPlugin = (await db('board_plugins as bp')
    .join('plugins as p', 'p.id', 'bp.plugin_id')
    .where('bp.board_id', boardId)
    .where('bp.plugin_id', pluginId)
    .whereNull('bp.disabled_at')
    .where('p.is_active', true)
    .select('p.id')
    .first()) as ActivePluginRow | undefined;

  if (!boardPlugin) {
    return Response.json(
      { error: { code: 'plugin-not-active-on-board', message: 'Plugin is not active on this board' } },
      { status: 404 },
    );
  }

  // Parse request body
  type TrelloTokenRequest = {
    scope?: string;
    expirationSeconds?: number;
  };
  let payload: TrelloTokenRequest = {};
  try {
    const text = await req.text();
    if (text) {
      const parsed = JSON.parse(text) as TrelloTokenRequest;
      payload = parsed;
    }
  } catch {
    // Empty body is acceptable
  }

  const scope = payload.scope || 'read';
  const expirationSeconds = payload.expirationSeconds || 3600;

  // Issue short-lived token
  try {
    const token = await issueTrelloCompatToken(
      {
        sub: currentUser.id,
        email: currentUser.email,
        scope,
      },
      expirationSeconds,
    );

    return Response.json(
      {
        data: {
          token,
          expiresIn: expirationSeconds,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to issue token';
    return Response.json(
      { error: { code: 'token-error', message } },
      { status: 500 },
    );
  }
}
