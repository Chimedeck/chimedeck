// GET /api/v1/boards/:id/activity — paginated board activity feed.
// PUBLIC boards: no auth required. WORKSPACE/PRIVATE: min role VIEWER.
import { db } from '../../../common/db';
import { requireWorkspaceMembership } from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';
import { VISIBLE_EVENT_TYPES } from '../config/visibleEventTypes';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type ActivityRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  payload: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getCardIdFromActivity(row: ActivityRow): string | null {
  if (row.entity_type === 'card' && typeof row.entity_id === 'string' && row.entity_id.length > 0) {
    return row.entity_id;
  }

  if (!isRecord(row.payload)) return null;
  const payloadCardId = row.payload.cardId;
  return typeof payloadCardId === 'string' && payloadCardId.length > 0 ? payloadCardId : null;
}

async function applyCursorFilter(query: ReturnType<typeof db>, cursor: string): Promise<ReturnType<typeof db>> {
  const cursorRow = await db('activities').where({ id: cursor }).first();
  if (!cursorRow) return query;

  return query.where(function () {
    this.where('activities.created_at', '<', cursorRow.created_at).orWhere(function () {
      this.where('activities.created_at', '=', cursorRow.created_at).andWhere(
        'activities.id',
        '<',
        cursor
      );
    });
  });
}

async function enrichRowsWithCardTitle(rows: unknown[]): Promise<unknown[]> {
  const cardIds = Array.from(
    new Set(
      rows
        .map((row) => getCardIdFromActivity(row as ActivityRow))
        .filter((id): id is string => Boolean(id))
    )
  );

  const cardsById = new Map<string, string>();
  if (cardIds.length > 0) {
    const cardRows = await db('cards').whereIn('id', cardIds).select('id', 'title');
    for (const card of cardRows) {
      if (typeof card.id === 'string' && typeof card.title === 'string') {
        cardsById.set(card.id, card.title);
      }
    }
  }

  return rows.map((row) => {
    const cardId = getCardIdFromActivity(row as ActivityRow);
    if (!cardId) return row;

    const cardTitle = cardsById.get(cardId);
    if (!cardTitle) return row;

    const payload = isRecord((row as ActivityRow).payload) ? (row as ActivityRow).payload : {};
    if (typeof payload.cardTitle === 'string' && payload.cardTitle.trim().length > 0) {
      return row;
    }

    return {
      ...row,
      payload: {
        ...payload,
        cardId,
        cardTitle,
      },
    };
  });
}

export async function handleBoardActivity(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;

  if (board.visibility !== 'PUBLIC') {
    const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
    if (membershipError) return membershipError;
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor') ?? null;
  const limitParam = parseInt(url.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Math.min(
    isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : limitParam,
    MAX_LIMIT
  );

  let query = db('activities')
    .leftJoin('users', 'activities.actor_id', 'users.id')
    .select('activities.*', 'users.name as actor_name')
    .where({ board_id: boardId })
    .whereIn('action', VISIBLE_EVENT_TYPES)
    .orderBy('activities.created_at', 'desc')
    .orderBy('activities.id', 'desc')
    .limit(limit + 1); // fetch one extra to determine hasMore

  if (cursor) query = await applyCursorFilter(query, cursor);

  const rows = await query;
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  // [why] Legacy comment activity rows may miss payload.cardTitle.
  //       Enrich response with title looked up by card id so UI always renders card links/text.
  const enrichedData = await enrichRowsWithCardTitle(data);
  const nextCursor =
    hasMore && data.length > 0 ? (data[data.length - 1] as { id: string }).id : null;

  return Response.json({
    data: enrichedData,
    metadata: { cursor: nextCursor, hasMore },
  });
}
