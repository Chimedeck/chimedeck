// GET /api/v1/workspaces/:id/cards/due?before=<ISO8601>
// Returns cards with due_date < before where the current user is assigned; min role VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleListDueCards(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspace = await db('workspaces').where({ id: workspaceId }).first();
  if (!workspace) {
    return Response.json(
      { error: { code: 'workspace-not-found', message: 'Workspace not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const url = new URL(req.url);
  const before = url.searchParams.get('before');

  if (!before) {
    return Response.json(
      { error: { code: 'bad-request', message: 'before query param (ISO 8601) is required' } },
      { status: 400 },
    );
  }

  const beforeDate = new Date(before);
  if (isNaN(beforeDate.getTime())) {
    return Response.json(
      { error: { code: 'bad-request', message: 'before must be a valid ISO 8601 date' } },
      { status: 400 },
    );
  }

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  // Cards assigned to caller where due_date < before, within the workspace
  const cards = await db('cards')
    .join('card_members', 'cards.id', 'card_members.card_id')
    .join('lists', 'cards.list_id', 'lists.id')
    .join('boards', 'lists.board_id', 'boards.id')
    .where('boards.workspace_id', workspaceId)
    .where('card_members.user_id', userId)
    .where('cards.archived', false)
    .whereNotNull('cards.due_date')
    .where('cards.due_date', '<', beforeDate.toISOString())
    .select('cards.*')
    .orderBy('cards.due_date', 'asc');

  return Response.json({ data: cards });
}
