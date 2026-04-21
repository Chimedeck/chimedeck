// PATCH /api/v1/lists/:id/sort — persist card order by selected criterion; min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { writeEvent } from '../../../mods/events/write';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';
import { generatePositions } from '../mods/fractional';

const SORT_VALUES = new Set(['created-desc', 'created-asc', 'card-name', 'due-date', 'card-price']);

type SortBy = 'created-desc' | 'created-asc' | 'card-name' | 'due-date' | 'card-price';

type CardRow = {
  id: string;
  list_id: string;
  position: string;
  title: string;
  created_at: string;
  due_date: string | null;
  amount: string | null;
  archived: boolean;
};

function toTime(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toAmount(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function compareCards(sortBy: SortBy, left: CardRow, right: CardRow): number {
  if (sortBy === 'created-desc') {
    return toTime(right.created_at, Number.NEGATIVE_INFINITY) - toTime(left.created_at, Number.NEGATIVE_INFINITY);
  }

  if (sortBy === 'created-asc') {
    return toTime(left.created_at, Number.POSITIVE_INFINITY) - toTime(right.created_at, Number.POSITIVE_INFINITY);
  }

  if (sortBy === 'card-name') {
    return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
  }

  if (sortBy === 'due-date') {
    const dueCompare = toTime(left.due_date, Number.POSITIVE_INFINITY) - toTime(right.due_date, Number.POSITIVE_INFINITY);
    if (dueCompare !== 0) return dueCompare;
    return toTime(right.created_at, Number.NEGATIVE_INFINITY) - toTime(left.created_at, Number.NEGATIVE_INFINITY);
  }

  const amountCompare = toAmount(right.amount) - toAmount(left.amount);
  if (amountCompare !== 0) return amountCompare;
  return toTime(right.created_at, Number.NEGATIVE_INFINITY) - toTime(left.created_at, Number.NEGATIVE_INFINITY);
}

export async function handleSortListCards(req: Request, listId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const list = await db('lists').where({ id: listId }).first();
  if (!list) {
    return Response.json(
      { error: { code: 'list-not-found', message: 'List not found' } },
      { status: 404 },
    );
  }

  const boardReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, list.board_id);
  if (writableError) return writableError;

  const board = boardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let body: { sortBy?: SortBy };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.sortBy || !SORT_VALUES.has(body.sortBy)) {
    return Response.json(
      { error: { code: 'bad-request', message: 'sortBy must be one of: created-desc, created-asc, card-name, due-date, card-price' } },
      { status: 400 },
    );
  }

  const cards = await db('cards')
    .where({ list_id: listId, archived: false })
    .select<CardRow[]>('id', 'list_id', 'position', 'title', 'created_at', 'due_date', 'amount', 'archived');

  if (cards.length < 2) {
    return Response.json({ data: cards.map((card) => ({ id: card.id, list_id: card.list_id, position: card.position })) });
  }

  const sortedCards = [...cards].sort((left, right) => compareCards(body.sortBy as SortBy, left, right));
  const positions = generatePositions(sortedCards.length);
  const now = new Date().toISOString();

  await db.transaction(async (trx) => {
    for (let i = 0; i < sortedCards.length; i += 1) {
      await trx('cards')
        .where({ id: sortedCards[i]!.id })
        .update({ position: positions[i], updated_at: now });
    }
  });

  const payloadCards = sortedCards.map((card, index) => ({
    id: card.id,
    list_id: card.list_id,
    position: positions[index]!,
  }));

  await writeEvent({
    type: 'list_cards_sorted',
    boardId: board.id,
    entityId: listId,
    actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system',
    payload: { listId, cards: payloadCards },
  });

  return Response.json({ data: payloadCards });
}
