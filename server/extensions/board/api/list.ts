// GET /api/v1/workspaces/:workspaceId/boards — list all boards; visibility-filtered per caller role.
//
// | Role           | Visible boards                                              |
// |----------------|-------------------------------------------------------------|
// | OWNER / ADMIN  | All boards (regardless of visibility or state)              |
// | MEMBER / VIEWER| WORKSPACE + PUBLIC boards, PLUS PRIVATE boards they are    |
// |                | explicitly listed in board_members                          |
// | GUEST          | Only boards they have explicit board_guest_access rows for  |
//
// Each board includes `isStarred` (boolean) for the current user.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  hasRole,
  type WorkspaceScopedRequest,
  type Role,
} from '../../../middlewares/permissionManager';

export async function handleListBoards(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  // All roles (including GUEST) may call this endpoint; visibility filtering is applied below.
  const callerRole = scopedReq.callerRole as Role;

  let boards: Array<Record<string, unknown>>;

  if (callerRole === 'GUEST') {
    // GUESTs only see boards they have been explicitly granted access to.
    boards = await db('boards as b')
      .join('board_guest_access as bga', function () {
        this.on('bga.board_id', '=', 'b.id').andOn('bga.user_id', '=', db.raw('?', [userId]));
      })
      .leftJoin('board_stars as bs', function () {
        this.on('bs.board_id', '=', 'b.id').andOn('bs.user_id', '=', db.raw('?', [userId]));
      })
      .where({ 'b.workspace_id': workspaceId })
      .select('b.*', db.raw('(bs.board_id IS NOT NULL) as "isStarred"'))
      .orderBy('b.created_at', 'asc');
  } else if (hasRole(callerRole, 'ADMIN')) {
    // OWNER / ADMIN see all boards.
    boards = await db('boards as b')
      .leftJoin('board_stars as bs', function () {
        this.on('bs.board_id', '=', 'b.id').andOn('bs.user_id', '=', db.raw('?', [userId]));
      })
      .where({ 'b.workspace_id': workspaceId })
      .select('b.*', db.raw('(bs.board_id IS NOT NULL) as "isStarred"'))
      .orderBy('b.created_at', 'asc');
  } else {
    // MEMBER / VIEWER: WORKSPACE or PUBLIC boards, plus PRIVATE boards with an explicit entry.
    boards = await db('boards as b')
      .leftJoin('board_stars as bs', function () {
        this.on('bs.board_id', '=', 'b.id').andOn('bs.user_id', '=', db.raw('?', [userId]));
      })
      .leftJoin('board_members as bm', function () {
        this.on('bm.board_id', '=', 'b.id').andOn('bm.user_id', '=', db.raw('?', [userId]));
      })
      .where({ 'b.workspace_id': workspaceId })
      .where(function () {
        this.whereIn('b.visibility', ['WORKSPACE', 'PUBLIC']).orWhereNotNull('bm.id');
      })
      .select('b.*', db.raw('(bs.board_id IS NOT NULL) as "isStarred"'))
      .orderBy('b.created_at', 'asc');
  }

  return Response.json({ data: boards });
}
