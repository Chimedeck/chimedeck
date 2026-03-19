// server/extensions/customFields/api/fieldDefinitions.ts
// GET/POST/PATCH/DELETE handlers for board-scoped custom field definitions.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { requireRole, type WorkspaceScopedRequest } from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';
import { requireBoardAccess, type BoardScopedRequest } from '../../board/middlewares/requireBoardAccess';
import { requireWorkspaceMembership } from '../../../middlewares/permissionManager';

export type FieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'CHECKBOX' | 'DROPDOWN';
const VALID_FIELD_TYPES: FieldType[] = ['TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'DROPDOWN'];

// GET /api/v1/boards/:id/custom-fields
export async function handleListCustomFields(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;

  if (board.visibility !== 'PUBLIC') {
    const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;
  }

  const fields = await db('custom_fields')
    .where({ board_id: boardId })
    .orderBy('position', 'asc')
    .orderBy('created_at', 'asc');

  return Response.json({ data: fields });
}

// POST /api/v1/boards/:id/custom-fields
export async function handleCreateCustomField(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  // Only ADMIN+ can create custom field definitions
  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: { name?: string; field_type?: FieldType; options?: unknown; show_on_card?: boolean; position?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'Invalid JSON body' } } },
      { status: 400 },
    );
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'name is required' } } },
      { status: 400 },
    );
  }

  if (!body.field_type || !VALID_FIELD_TYPES.includes(body.field_type)) {
    return Response.json(
      { error: { name: 'bad-request', data: { message: `field_type must be one of: ${VALID_FIELD_TYPES.join(', ')}` } } },
      { status: 400 },
    );
  }

  if (body.field_type === 'DROPDOWN' && body.options !== undefined && !Array.isArray(body.options)) {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'options must be an array for DROPDOWN fields' } } },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const field = {
    id,
    board_id: boardId,
    name: body.name.trim(),
    field_type: body.field_type,
    options: body.field_type === 'DROPDOWN' ? JSON.stringify(body.options ?? []) : null,
    show_on_card: body.show_on_card ?? false,
    position: body.position ?? 0,
  };

  await db('custom_fields').insert(field);
  const created = await db('custom_fields').where({ id }).first();

  return Response.json({ data: created }, { status: 201 });
}

// PATCH /api/v1/boards/:id/custom-fields/:fieldId
export async function handleUpdateCustomField(
  req: Request,
  boardId: string,
  fieldId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  const existing = await db('custom_fields').where({ id: fieldId, board_id: boardId }).first();
  if (!existing) {
    return Response.json(
      { error: { name: 'custom-field-not-found', data: { message: 'Custom field not found' } } },
      { status: 404 },
    );
  }

  let body: { name?: string; options?: unknown; show_on_card?: boolean; position?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'Invalid JSON body' } } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      return Response.json(
        { error: { name: 'bad-request', data: { message: 'name must be a non-empty string' } } },
        { status: 400 },
      );
    }
    updates.name = body.name.trim();
  }

  if (body.options !== undefined) {
    if (existing.field_type !== 'DROPDOWN') {
      return Response.json(
        { error: { name: 'bad-request', data: { message: 'options can only be set on DROPDOWN fields' } } },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.options)) {
      return Response.json(
        { error: { name: 'bad-request', data: { message: 'options must be an array' } } },
        { status: 400 },
      );
    }
    updates.options = JSON.stringify(body.options);
  }

  if (body.show_on_card !== undefined) {
    updates.show_on_card = body.show_on_card;
  }

  if (body.position !== undefined) {
    updates.position = body.position;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: { name: 'bad-request', data: { message: 'No updatable fields provided' } } },
      { status: 400 },
    );
  }

  await db('custom_fields').where({ id: fieldId }).update(updates);
  const updated = await db('custom_fields').where({ id: fieldId }).first();

  return Response.json({ data: updated });
}

// DELETE /api/v1/boards/:id/custom-fields/:fieldId
export async function handleDeleteCustomField(
  req: Request,
  boardId: string,
  fieldId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const board = boardReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  const existing = await db('custom_fields').where({ id: fieldId, board_id: boardId }).first();
  if (!existing) {
    return Response.json(
      { error: { name: 'custom-field-not-found', data: { message: 'Custom field not found' } } },
      { status: 404 },
    );
  }

  // Cascade delete of card_custom_field_values is handled by FK onDelete('CASCADE')
  await db('custom_fields').where({ id: fieldId }).delete();

  return new Response(null, { status: 204 });
}
