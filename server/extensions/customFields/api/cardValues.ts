// server/extensions/customFields/api/cardValues.ts
// GET/PUT/DELETE handlers for card-scoped custom field values.
// Routes: /api/v1/cards/:cardId/custom-field-values/:fieldId
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

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

// Build the DB value columns for a given field type; returns { data } or { error }.
function buildValuePayload(
  fieldType: FieldType,
  body: Record<string, unknown>,
): { data: Record<string, unknown> } | { error: { name: string; data: { message: string } } } {
  // All columns start null so previous values are cleared on upsert.
  const base: Record<string, unknown> = {
    value_text: null,
    value_number: null,
    value_date: null,
    value_checkbox: null,
    value_option_id: null,
  };

  switch (fieldType) {
    case 'TEXT': {
      if (body.value === undefined || body.value === null) {
        return { error: { name: 'bad-request', data: { message: 'value is required for TEXT fields' } } };
      }
      if (typeof body.value !== 'string') {
        return { error: { name: 'bad-request', data: { message: 'value must be a string for TEXT fields' } } };
      }
      return { data: { ...base, value_text: body.value } };
    }

    case 'NUMBER': {
      if (body.value === undefined || body.value === null) {
        return { error: { name: 'bad-request', data: { message: 'value is required for NUMBER fields' } } };
      }
      const num = Number(body.value);
      if (isNaN(num)) {
        return { error: { name: 'bad-request', data: { message: 'value must be a number for NUMBER fields' } } };
      }
      return { data: { ...base, value_number: num } };
    }

    case 'DATE': {
      if (body.value === undefined || body.value === null) {
        return { error: { name: 'bad-request', data: { message: 'value is required for DATE fields' } } };
      }
      const d = new Date(body.value as string);
      if (isNaN(d.getTime())) {
        return { error: { name: 'bad-request', data: { message: 'value must be a valid ISO date string for DATE fields' } } };
      }
      return { data: { ...base, value_date: d.toISOString() } };
    }

    case 'CHECKBOX': {
      if (body.value === undefined || body.value === null) {
        return { error: { name: 'bad-request', data: { message: 'value is required for CHECKBOX fields' } } };
      }
      if (typeof body.value !== 'boolean') {
        return { error: { name: 'bad-request', data: { message: 'value must be a boolean for CHECKBOX fields' } } };
      }
      return { data: { ...base, value_checkbox: body.value } };
    }

    case 'DROPDOWN': {
      if (body.value === undefined || body.value === null) {
        return { error: { name: 'bad-request', data: { message: 'value is required for DROPDOWN fields' } } };
      }
      if (typeof body.value !== 'string') {
        return { error: { name: 'bad-request', data: { message: 'value must be an option id string for DROPDOWN fields' } } };
      }
      return { data: { ...base, value_option_id: body.value } };
    }

    default:
      return { error: { name: 'bad-request', data: { message: 'Unknown field type' } } };
  }
}
