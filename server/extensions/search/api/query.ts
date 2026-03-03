// server/extensions/search/api/query.ts
// GET /api/v1/workspaces/:id/search
// Full-text search over boards and cards in a workspace.
// RBAC: VIEWER and above may search within their own workspace.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { flags } from '../../../mods/flags';
import { buildQuery } from '../mods/buildQuery';

const DEFAULT_LIMIT = 20;

export async function handleSearch(req: Request, workspaceId: string): Promise<Response> {
  // Guard: SEARCH_ENABLED feature flag
  const searchEnabled = await flags.isEnabled('SEARCH_ENABLED');
  if (!searchEnabled) {
    return Response.json(
      { name: 'search-not-available', data: { message: 'Search feature is not enabled' } },
      { status: 501 },
    );
  }

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspace = await db('workspaces').where({ id: workspaceId }).first();
  if (!workspace) {
    return Response.json(
      { name: 'workspace-not-found', data: { message: 'Workspace not found' } },
      { status: 404 },
    );
  }

  // RBAC — VIEWER is the minimum role; requireWorkspaceMembership enforces membership
  const membershipError = await requireWorkspaceMembership(
    req as WorkspaceScopedRequest,
    workspaceId,
  );
  if (membershipError) return membershipError;

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const type = url.searchParams.get('type'); // 'board' | 'card' | null
  const cursor = url.searchParams.get('cursor');
  const includeArchived = url.searchParams.get('includeArchived') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10), 100);

  if (q.length < 2) {
    return Response.json(
      { name: 'search-query-too-short', data: { message: 'Query must be at least 2 characters' } },
      { status: 400 },
    );
  }

  const tsquery = buildQuery({ q });
  if (!tsquery) {
    return Response.json(
      { name: 'search-query-invalid', data: { message: 'Query contains no searchable terms' } },
      { status: 400 },
    );
  }

  const results: Array<Record<string, unknown>> = [];

  // Search boards
  if (!type || type === 'board') {
    let boardQ = db('boards')
      .select(
        db.raw(`id, title, workspace_id, state, 'board' as type,
          ts_rank_cd(search_vector, to_tsquery('english', ?)) AS rank`, [tsquery]),
      )
      .where('workspace_id', workspaceId)
      .whereRaw(`search_vector @@ to_tsquery('english', ?)`, [tsquery]);

    if (!includeArchived) boardQ = boardQ.where('state', 'ACTIVE');
    if (cursor) boardQ = boardQ.where('id', '>', cursor);

    const boards = await boardQ.orderBy('rank', 'desc').limit(limit);
    results.push(...boards);
  }

  // Search cards
  if (!type || type === 'card') {
    // Cards belong to lists which belong to boards which belong to workspaces
    let cardQ = db('cards')
      .join('lists', 'cards.list_id', 'lists.id')
      .join('boards', 'lists.board_id', 'boards.id')
      .select(
        db.raw(
          `cards.id, cards.title, cards.list_id, boards.id as board_id, boards.workspace_id, cards.archived, 'card' as type,
          ts_rank_cd(cards.search_vector, to_tsquery('english', ?)) AS rank`,
          [tsquery],
        ),
      )
      .where('boards.workspace_id', workspaceId)
      .whereRaw(`cards.search_vector @@ to_tsquery('english', ?)`, [tsquery]);

    if (!includeArchived) cardQ = cardQ.where('cards.archived', false);
    if (cursor) cardQ = cardQ.where('cards.id', '>', cursor);

    const cards = await cardQ.orderBy('rank', 'desc').limit(limit);
    results.push(...cards);
  }

  // Sort combined results by rank descending, then slice to limit
  results.sort((a, b) => Number(b['rank'] ?? 0) - Number(a['rank'] ?? 0));
  const page = results.slice(0, limit);
  const hasMore = results.length > limit;
  const nextCursor = hasMore ? (page[page.length - 1]?.['id'] as string | null) ?? null : null;

  return Response.json({
    data: page,
    metadata: { cursor: nextCursor, hasMore },
  });
}
