// GET /api/v1/boards/:id/archived-cards — all archived cards in a board.
// PUBLIC boards: no auth required. WORKSPACE/PRIVATE: min role VIEWER.
import { db } from '../../../common/db';
import { requireWorkspaceMembership } from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';

type ResolvedBoardRequest = BoardVisibilityScopedRequest & {
  board: { id: string; workspace_id: string; visibility: string };
};

type ArchivedCardRow = {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: string;
  archived: boolean;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  list_title: string;
};

export async function handleGetArchivedCards(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as ResolvedBoardRequest;
  const board = scopedReq.board;
  const resolvedBoardId = board.id;

  if (board.visibility !== 'PUBLIC') {
    const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
    if (membershipError) return membershipError;
  }

  const cardRows = await db<ArchivedCardRow>('cards')
    .join('lists', 'cards.list_id', 'lists.id')
    .where('lists.board_id', resolvedBoardId)
    .where('cards.archived', true)
    .orderBy('cards.updated_at', 'desc')
    .select(
      'cards.id',
      'cards.list_id',
      'cards.title',
      'cards.description',
      'cards.position',
      'cards.archived',
      'cards.start_date',
      'cards.due_date',
      'cards.created_at',
      'cards.updated_at',
      'lists.title as list_title'
    ) as ArchivedCardRow[];

  const cardIds = cardRows.map((card) => card.id);

  let labelsByCardId = new Map<string, Array<{ id: string; name: string; color: string }>>();
  if (cardIds.length > 0) {
    const cardLabelRows = await db('card_labels')
      .join('labels', 'card_labels.label_id', 'labels.id')
      .whereIn('card_labels.card_id', cardIds)
      .select(
        'card_labels.card_id',
        'labels.id as label_id',
        'labels.name as label_name',
        'labels.color as label_color',
      ) as Array<{
        card_id: string;
        label_id: string;
        label_name: string;
        label_color: string;
      }>;

    labelsByCardId = cardLabelRows.reduce(
      (acc, row) => {
        const cardId = row.card_id;
        const existing = acc.get(cardId) ?? [];
        existing.push({ id: row.label_id, name: row.label_name, color: row.label_color });
        acc.set(cardId, existing);
        return acc;
      },
      new Map<string, Array<{ id: string; name: string; color: string }>>(),
    );
  }

  const cards = cardRows.map((card) => ({
    ...card,
    labels: labelsByCardId.get(card.id) ?? [],
  }));

  return Response.json({ data: cards });
}
