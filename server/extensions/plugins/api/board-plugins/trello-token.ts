// POST /api/v1/boards/:boardId/plugins/:pluginId/trello-token
// Issues a short-lived JWT token for Trello-compatible API access.
// Used by plugin iframes via the API_AUTHORIZE / API_GET_TOKEN / API_REQUEST messages.
import { db } from '../../../common/db';
import { getTrelloAuthUser } from '../../trelloCompat/middlewares/trelloAuth';
import { issueTrelloCompatToken } from '../../auth/mods/token/trelloCompatToken';
import type { AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleGetTrelloCompatToken(
  req: Request,
  boardId: string,
  pluginId: string,
): Promise<Response> {
  // Verify user is authenticated
  const user = getTrelloAuthUser(req as AuthenticatedRequest);
  if (!user) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Must be authenticated' } },
      { status: 401 },
    );
  }

  // Verify user has access to the board (any role)
  const membership = await db('board_members')
    .where({ board_id: boardId, user_id: user.id })
    .where('role', 'in', ['admin', 'member', 'guest'])
    .select('id')
    .first();

  if (!membership) {
    return Response.json(
      { error: { code: 'forbidden', message: 'No access to this board' } },
      { status: 403 },
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
    if (text) payload = JSON.parse(text);
  } catch {
    // Empty body is acceptable
  }

  const scope = payload.scope || 'read';
  const expirationSeconds = payload.expirationSeconds || 3600;

  // Issue short-lived token
  try {
    const token = await issueTrelloCompatToken(
      {
        sub: user.id,
        email: user.email,
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
