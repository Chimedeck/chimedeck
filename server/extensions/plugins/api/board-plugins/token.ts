// GET /api/v1/boards/:boardId/plugins/:pluginId/token
// Issues a short-lived HS256 JWT scoped to one plugin + board + user.
// The plugin's api_key (stored server-side only) is used as the HMAC secret —
// it is never sent to the client. The returned token is what plugin iframes
// pass to plugin-data endpoints instead of the raw api_key.
import { SignJWT } from 'jose';
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';

// Token TTL: 1 hour — long enough for a working session, short enough to limit blast radius.
const TOKEN_TTL_SECONDS = 60 * 60;

export async function handleGetPluginToken(
  req: Request,
  boardId: string,
  pluginId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authedReq = req as AuthenticatedRequest;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  // Verify the requesting user is a member of the board's workspace.
  const membershipError = await requireWorkspaceMembership(
    req as WorkspaceScopedRequest,
    board.workspace_id,
  );
  if (membershipError) return membershipError;

  // Verify the plugin is active on this board.
  const boardPlugin = await db('board_plugins as bp')
    .join('plugins as p', 'p.id', 'bp.plugin_id')
    .where('bp.board_id', boardId)
    .where('bp.plugin_id', pluginId)
    .whereNull('bp.disabled_at')
    .where('p.is_active', true)
    .select('p.id', 'p.api_key')
    .first();

  if (!boardPlugin) {
    return Response.json(
      { error: { code: 'plugin-not-active-on-board', message: 'Plugin is not active on this board' } },
      { status: 404 },
    );
  }

  if (!boardPlugin.api_key) {
    return Response.json(
      { error: { code: 'plugin-misconfigured', message: 'Plugin has no API key configured' } },
      { status: 500 },
    );
  }

  // Sign a short-lived token. The HMAC secret is the plugin's api_key — server-side only.
  // Claims: pluginId + boardId scope it to exactly one plugin on one board.
  // userId allows private-visibility data isolation per user.
  const secret = new TextEncoder().encode(boardPlugin.api_key as string);
  const token = await new SignJWT({
    pluginId: boardPlugin.id,
    boardId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(authedReq.currentUser!.id)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret);

  return Response.json({
    data: {
      token,
      expiresIn: TOKEN_TTL_SECONDS,
    },
  });
}
