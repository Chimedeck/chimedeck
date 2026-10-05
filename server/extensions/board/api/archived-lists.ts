// GET /api/v1/boards/:id/archived-lists — all archived lists in a board.
// PUBLIC boards: no auth required. WORKSPACE/PRIVATE: min role VIEWER.
// Mirrors archived-cards.ts: GET /boards/:id/lists returns active lists only,
// so this is the only way to see a list after PATCH /lists/:id/archive.
import { db } from '../../../common/db';
import { requireWorkspaceMembership } from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';

type ResolvedBoardRequest = BoardVisibilityScopedRequest & {
  board: { id: string; workspace_id: string; visibility: string };
};

type ArchivedListRow = {
  id: string;
  board_id: string;
  title: string;
  position: string;
  archived: boolean;
  color: string | null;
  short_id: string | null;
};

export async function handleGetArchivedLists(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as ResolvedBoardRequest;
  const board = scopedReq.board;

  if (board.visibility !== 'PUBLIC') {
    const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
    if (membershipError) return membershipError;
  }

  const lists = (await db<ArchivedListRow>('lists')
    .where('lists.board_id', board.id)
    .where('lists.archived', true)
    .orderBy('lists.position', 'asc')
    .select(
      'lists.id',
      'lists.board_id',
      'lists.title',
      'lists.position',
      'lists.archived',
      'lists.color',
      'lists.short_id',
    )) as ArchivedListRow[];

  return Response.json({ data: lists });
}
