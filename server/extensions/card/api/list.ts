// GET /api/v1/lists/:listId/cards — list active cards in a list; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleListCards(req: Request, listId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const list = await db('lists').where({ id: listId }).first();
  if (!list) {
    return Response.json(
      { name: 'list-not-found', data: { message: 'List not found' } },
      { status: 404 },
    );
  }

  const board = await db('boards').where({ id: list.board_id }).first();
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const rows = await db('cards as c')
    .leftJoin('card_labels as cl', 'cl.card_id', 'c.id')
    .leftJoin('labels as l', 'l.id', 'cl.label_id')
    .where({ 'c.list_id': listId, 'c.archived': false })
    .orderBy('c.position', 'asc')
    .select(
      'c.*',
      db.raw(
        `json_group_array(
          CASE WHEN l.id IS NOT NULL THEN
            json_object('id', l.id, 'name', l.name, 'color', l.color)
          ELSE NULL END
        ) as labels_json`,
      ),
    )
    .groupBy('c.id');

  const cards = rows.map((row) => {
    const rawLabels: Array<{ id: string; name: string; color: string } | null> = (() => {
      try {
        return JSON.parse(row.labels_json ?? '[]');
      } catch {
        return [];
      }
    })();
    const { labels_json: _l, ...card } = row;
    return { ...card, labels: rawLabels.filter(Boolean) };
  });

  return Response.json({ data: cards });
}
