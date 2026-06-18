// Request context helpers — normalised workspace resolution for middleware.
// Used by featureGate and (later) limitGuard to resolve the workspace that
// owns the resource being operated on, without coupling to individual route handlers.

import { db } from './db';

export interface RequestWorkspaceContext {
  workspaceId: string | null;
}

/**
 * Resolve the workspace ID from the request path.
 *
 * Resolution order (first match wins):
 * 1. `/workspaces/:workspaceId/...` — extracted directly from the path.
 * 2. `/boards/:boardId/...` — resolved via board.workspace_id DB lookup.
 * 3. `/cards/:cardId/...` — resolved via card → board → workspace_id DB lookup.
 *
 * Returns `null` when no workspace context can be inferred (e.g. user-scoped
 * or global routes such as `/tokens` or `/webhooks`). Callers should treat
 * `null` as "no workspace context available" and skip workspace-tier enforcement.
 */
export async function resolveRequestWorkspaceId(path: string): Promise<string | null> {
  // Direct workspace path: /api/v1/workspaces/:workspaceId/...
  const workspaceMatch = /^\/api\/v1\/workspaces\/([^/]+)/.exec(path);
  if (workspaceMatch?.[1]) return workspaceMatch[1];

  // Board-scoped path: /api/v1/boards/:boardId/...
  const boardMatch = /^\/api\/v1\/boards\/([^/]+)/.exec(path);
  if (boardMatch) {
    const board = await db('boards')
      .where({ id: boardMatch[1] })
      .select('workspace_id')
      .first<{ workspace_id: string }>();
    return board?.workspace_id ?? null;
  }

  // Card-scoped path: /api/v1/cards/:cardId/...
  const cardMatch = /^\/api\/v1\/cards\/([^/]+)/.exec(path);
  if (cardMatch) {
    const card = await db('cards')
      .where({ id: cardMatch[1] })
      .select('list_id')
      .first<{ list_id: string }>();
    if (!card) return null;
    const list = await db('lists')
      .where({ id: card.list_id })
      .select('board_id')
      .first<{ board_id: string }>();
    if (!list) return null;
    const board = await db('boards')
      .where({ id: list.board_id })
      .select('workspace_id')
      .first<{ workspace_id: string }>();
    return board?.workspace_id ?? null;
  }

  // List-scoped path: /api/v1/lists/:listId/...
  const listMatch = /^\/api\/v1\/lists\/([^/]+)/.exec(path);
  if (listMatch) {
    const list = await db('lists')
      .where({ id: listMatch[1] })
      .select('board_id')
      .first<{ board_id: string }>();
    if (!list) return null;
    const board = await db('boards')
      .where({ id: list.board_id })
      .select('workspace_id')
      .first<{ workspace_id: string }>();
    return board?.workspace_id ?? null;
  }

  return null;
}

/**
 * Resolve the request-scoped workspace context used by middleware.
 *
 * Keeping this wrapper separate makes the workspace lookup reusable in the
 * request pipeline without duplicating the resolution logic.
 */
export async function resolveRequestWorkspaceContext(
  path: string
): Promise<RequestWorkspaceContext> {
  return { workspaceId: await resolveRequestWorkspaceId(path) };
}
