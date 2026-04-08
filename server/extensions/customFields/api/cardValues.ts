// server/extensions/customFields/api/cardValues.ts
// GET/PUT/DELETE handlers for card-scoped custom field values.
// Routes:
//   GET  /api/v1/boards/:boardId/custom-field-values?cardIds=id1,id2,... — batch fetch for board
//   GET  /api/v1/cards/:cardId/custom-field-values          — list all values for card
//   GET  /api/v1/cards/:cardId/custom-field-values/:fieldId — get single value
//   PUT  /api/v1/cards/:cardId/custom-field-values/:fieldId — upsert value
//   DELETE /api/v1/cards/:cardId/custom-field-values/:fieldId — delete value
// Payload format mirrors client UpsertCardFieldValuePayload:
//   { value_text?, value_number?, value_date?, value_checkbox?, value_option_id? }
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { sanitizeText } from '../../../common/sanitize';

export type FieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'CHECKBOX' | 'DROPDOWN';

async function resolveCardContext(
  cardId: string,
): Promise<{ card: Record<string, unknown>; board: Record<string, unknown> } | null> {
  const card = await db('cards').where({ id: cardId }).first();
  if (!card) return null;
  const list = await db('lists').where({ id: card.list_id }).first();
  if (!list) return null;
  const board = await db('boards').where({ id: list.board_id }).first();
  if (!board) return null;
  return { card, board };
}

// GET /api/v1/cards/:cardId/custom-field-values — list all values for a card
export async function handleListCardFieldValues(req: Request, cardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const ctx = await resolveCardContext(cardId);
  if (!ctx) {
    return Response.json(
      { error: { name: 'card-not-found', data: { message: 'Card not found' } } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(
    scopedReq,
    ctx.board.workspace_id as string,
  );
  if (membershipError) return membershipError;

  const values = await db('card_custom_field_values').where({ card_id: cardId });
  return Response.json({ data: values });
}

// GET /api/v1/cards/:cardId/custom-field-values/:fieldId
export async function handleGetCardFieldValue(
  req: Request,
  cardId: string,
  fieldId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const ctx = await resolveCardContext(cardId);
  if (!ctx) {
    return Response.json(
      { error: { name: 'card-not-found', data: { message: 'Card not found' } } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(
    scopedReq,
    ctx.board.workspace_id as string,
  );
  if (membershipError) return membershipError;

  const field = await db('custom_fields').where({ id: fieldId }).first();
  if (!field) {
    return Response.json(
      { error: { name: 'custom-field-not-found', data: { message: 'Custom field not found' } } },
      { status: 404 },
    );
  }

  const value = await db('card_custom_field_values')
    .where({ card_id: cardId, custom_field_id: fieldId })
    .first();

  if (!value) {
    return Response.json(
      { error: { name: 'custom-field-value-not-found', data: { message: 'No value set for this field on this card' } } },
      { status: 404 },
    );
  }

  return Response.json({ data: value });
}

// PUT /api/v1/cards/:cardId/custom-field-values/:fieldId — upsert value
export async function handleUpsertCardFieldValue(
  req: Request,
  cardId: string,
  fieldId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const ctx = await resolveCardContext(cardId);
  if (!ctx) {
    return Response.json(
      { error: { name: 'card-not-found', data: { message: 'Card not found' } } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(
    scopedReq,
    ctx.board.workspace_id as string,
  );
  if (membershipError) return membershipError;

  if ((ctx.board as Record<string, unknown>).state === 'ARCHIVED') {
    return Response.json(
      { error: { code: 'board-is-archived', message: 'This board is archived and cannot be modified.' } },
      { status: 403 },
    );
  }

  const field = await db('custom_fields').where({ id: fieldId }).first();
  if (!field) {
    return Response.json(
      { error: { name: 'custom-field-not-found', data: { message: 'Custom field not found' } } },
      { status: 404 },
    );
  }

  // Ensure the field belongs to the same board as the card
  if (field.board_id !== (ctx.board as Record<string, unknown>).id) {
    return Response.json(
      {
        error: {
          name: 'custom-field-board-mismatch',
          data: { message: 'Custom field does not belong to the board of this card' },
        },
      },
      { status: 422 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'Invalid JSON body' } } },
      { status: 400 },
    );
  }

  const fieldType = field.field_type as FieldType;
  const valuePayload = buildValuePayload(fieldType, body);
  if ('error' in valuePayload) {
    return Response.json({ error: valuePayload.error }, { status: 400 });
  }

  const existing = await db('card_custom_field_values')
    .where({ card_id: cardId, custom_field_id: fieldId })
    .first();

  if (existing) {
    await db('card_custom_field_values')
      .where({ card_id: cardId, custom_field_id: fieldId })
      .update(valuePayload.data);
  } else {
    await db('card_custom_field_values').insert({
      id: randomUUID(),
      card_id: cardId,
      custom_field_id: fieldId,
      ...valuePayload.data,
    });
  }

  const saved = await db('card_custom_field_values')
    .where({ card_id: cardId, custom_field_id: fieldId })
    .first();

  return Response.json({ data: saved }, { status: existing ? 200 : 201 });
}

// DELETE /api/v1/cards/:cardId/custom-field-values/:fieldId
export async function handleDeleteCardFieldValue(
  req: Request,
  cardId: string,
  fieldId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const ctx = await resolveCardContext(cardId);
  if (!ctx) {
    return Response.json(
      { error: { name: 'card-not-found', data: { message: 'Card not found' } } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(
    scopedReq,
    ctx.board.workspace_id as string,
  );
  if (membershipError) return membershipError;

  if ((ctx.board as Record<string, unknown>).state === 'ARCHIVED') {
    return Response.json(
      { error: { code: 'board-is-archived', message: 'This board is archived and cannot be modified.' } },
      { status: 403 },
    );
  }

  const existing = await db('card_custom_field_values')
    .where({ card_id: cardId, custom_field_id: fieldId })
    .first();

  if (!existing) {
    return Response.json(
      { error: { name: 'custom-field-value-not-found', data: { message: 'No value to delete' } } },
      { status: 404 },
    );
  }

  await db('card_custom_field_values')
    .where({ card_id: cardId, custom_field_id: fieldId })
    .delete();

  return new Response(null, { status: 204 });
}

// Build the DB value columns from the client payload (value_text, value_number, etc.).
// [why] The client sends field-specific keys; we validate and write only the relevant
//       column, nulling out all others to prevent stale data from previous type upserts.
function buildValuePayload(
  fieldType: FieldType,
  body: Record<string, unknown>,
): { data: Record<string, unknown> } | { error: { name: string; data: { message: string } } } {
  // All columns start null — clears any previous value of a different type.
  const base: Record<string, unknown> = {
    value_text: null,
    value_number: null,
    value_date: null,
    value_checkbox: null,
    value_option_id: null,
  };

  switch (fieldType) {
    case 'TEXT': {
      // Accept either value_text (client format) or value (legacy)
      const raw = body.value_text !== undefined ? body.value_text : body.value;
      if (raw === undefined || raw === null) {
        return { data: base }; // explicit clear
      }
      if (typeof raw !== 'string') {
        return { error: { name: 'bad-request', data: { message: 'value_text must be a string' } } };
      }
      return { data: { ...base, value_text: sanitizeText(raw) } };
    }

    case 'NUMBER': {
      const raw = body.value_number !== undefined ? body.value_number : body.value;
      if (raw === undefined || raw === null) {
        return { data: base }; // explicit clear
      }
      const num = Number(raw);
      if (isNaN(num)) {
        return { error: { name: 'bad-request', data: { message: 'value_number must be a number' } } };
      }
      return { data: { ...base, value_number: num } };
    }

    case 'DATE': {
      const raw = body.value_date !== undefined ? body.value_date : body.value;
      if (raw === undefined || raw === null) {
        return { data: base }; // explicit clear
      }
      const d = new Date(raw as string);
      if (isNaN(d.getTime())) {
        return { error: { name: 'bad-request', data: { message: 'value_date must be a valid ISO date string' } } };
      }
      return { data: { ...base, value_date: d.toISOString() } };
    }

    case 'CHECKBOX': {
      const raw = body.value_checkbox !== undefined ? body.value_checkbox : body.value;
      if (raw === undefined || raw === null) {
        return { data: base }; // explicit clear
      }
      if (typeof raw !== 'boolean') {
        return { error: { name: 'bad-request', data: { message: 'value_checkbox must be a boolean' } } };
      }
      return { data: { ...base, value_checkbox: raw } };
    }

    case 'DROPDOWN': {
      const raw = body.value_option_id !== undefined ? body.value_option_id : body.value;
      if (raw === undefined || raw === null) {
        return { data: base }; // explicit clear
      }
      if (typeof raw !== 'string') {
        return { error: { name: 'bad-request', data: { message: 'value_option_id must be a string' } } };
      }
      return { data: { ...base, value_option_id: raw } };
    }

    default:
      return { error: { name: 'bad-request', data: { message: 'Unknown field type' } } };
  }
}

async function parseBatchCardIds(req: Request): Promise<string[] | Response> {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const cardIdsParam = url.searchParams.get('cardIds') ?? '';
    return cardIdsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  if (req.method === 'POST') {
    let body: { cardIds?: unknown };
    try {
      body = (await req.json()) as { cardIds?: unknown };
    } catch {
      return Response.json(
        { error: { name: 'bad-request', data: { message: 'Invalid JSON body' } } },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.cardIds)) {
      return Response.json(
        { error: { name: 'bad-request', data: { message: 'cardIds must be an array of strings' } } },
        { status: 400 },
      );
    }

    const invalid = body.cardIds.some((id) => typeof id !== 'string');
    if (invalid) {
      return Response.json(
        { error: { name: 'bad-request', data: { message: 'cardIds must be an array of strings' } } },
        { status: 400 },
      );
    }

    return body.cardIds.map((id) => id.trim()).filter(Boolean);
  }

  return [];
}

// GET/POST /api/v1/boards/:boardId/custom-field-values
// [why] Fetches values for multiple cards in a single DB query instead of N
//       individual requests — prevents the board page from DDoSing the server
//       when every card tile independently calls the single-card endpoint.
export async function handleBatchCardFieldValues(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { error: { name: 'board-not-found', data: { message: 'Board not found' } } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id as string);
  if (membershipError) return membershipError;

  const parsedIds = await parseBatchCardIds(req);
  if (parsedIds instanceof Response) return parsedIds;
  const requestedIds = parsedIds;

  if (requestedIds.length === 0) {
    return Response.json({ data: [] });
  }

  // [security] Only return values for cards that actually belong to this board,
  // preventing an authenticated member from probing cards from other boards.
  const boardCardIds: string[] = await db('cards')
    .join('lists', 'cards.list_id', 'lists.id')
    .where('lists.board_id', boardId)
    .whereIn('cards.id', requestedIds)
    .pluck('cards.id');

  if (boardCardIds.length === 0) {
    return Response.json({ data: [] });
  }

  const values = await db('card_custom_field_values').whereIn('card_id', boardCardIds);
  return Response.json({ data: values });
}
