import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import { resolveBoardId } from '../../../../common/ids/resolveEntityId';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  TRELLO_CUSTOM_FIELD_NOT_FOUND,
  TRELLO_CUSTOM_FIELD_OPTION_NOT_FOUND,
  TRELLO_NOT_FOUND,
  TRELLO_PERMISSION_DENIED,
  trelloError,
} from '../../common/errors';
import { getTrelloAuthUser } from '../../middlewares/trelloAuth';
import { serializeCustomField } from '../../serializers/customField';

type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';
const ROLE_RANK: Record<MembershipRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
  GUEST: 0,
};

type BoardRow = {
  id: string;
  workspace_id: string;
  state: 'ACTIVE' | 'ARCHIVED';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'WORKSPACE' | null;
};

type CustomFieldOptionRow = {
  id: string;
  value: string | { text?: string };
  color?: string | null;
};

type CustomFieldRow = {
  id: string;
  board_id: string;
  name: string;
  field_type: 'TEXT' | 'NUMBER' | 'DATE' | 'CHECKBOX' | 'DROPDOWN';
  options?: CustomFieldOptionRow[] | string | null;
  show_on_card?: boolean | null;
  position?: number | string | null;
};

const CUSTOM_FIELD_TYPES = new Set(['text', 'number', 'date', 'checkbox', 'list']);

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === 'GET') return {};
  const text = await req.text();
  if (!text.trim()) return {};

  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
}

function getInput(url: URL, body: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const fromQuery = url.searchParams.get(key);
    if (fromQuery !== null) return fromQuery;
    if (Object.hasOwn(body, key)) return body[key];
  }
  return undefined;
}

function parseCustomFieldOptions(raw: unknown): CustomFieldOptionRow[] {
  if (Array.isArray(raw)) return raw as CustomFieldOptionRow[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as CustomFieldOptionRow[];
    } catch {
      return [];
    }
  }
  return [];
}

function fieldTypeToDb(value: string): CustomFieldRow['field_type'] {
  if (value === 'text') return 'TEXT';
  if (value === 'number') return 'NUMBER';
  if (value === 'date') return 'DATE';
  if (value === 'checkbox') return 'CHECKBOX';
  return 'DROPDOWN';
}

async function getWorkspaceRole(userId: string, workspaceId: string): Promise<MembershipRole | null> {
  const memberships = await db('memberships')
    .where({ user_id: userId, workspace_id: workspaceId })
    .select('role');

  let highest: MembershipRole | null = null;
  for (const row of memberships as Array<{ role: string }>) {
    if (!(row.role in ROLE_RANK)) continue;
    const role = row.role as MembershipRole;
    if (!highest || ROLE_RANK[role] > ROLE_RANK[highest]) highest = role;
  }
  return highest;
}

async function getBoardMemberRole(userId: string, boardId: string): Promise<'ADMIN' | 'MEMBER' | 'VIEWER' | null> {
  const row = await db('board_members').where({ user_id: userId, board_id: boardId }).first() as { role?: string } | undefined;
  const role = row?.role;
  if (role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER') return role;
  return null;
}

async function hasGuestAccess(userId: string, boardId: string): Promise<boolean> {
  const row = await db('board_guest_access').where({ user_id: userId, board_id: boardId }).first() as { id: string } | undefined;
  return !!row;
}

async function canReadBoard(userId: string, board: BoardRow): Promise<boolean> {
  const role = await getWorkspaceRole(userId, board.workspace_id);
  if (!role) return false;
  if (role === 'OWNER' || role === 'ADMIN') return true;

  const visibility = board.visibility ?? 'PRIVATE';
  if (role === 'GUEST') {
    if (visibility === 'PUBLIC') return true;
    return hasGuestAccess(userId, board.id);
  }
  if (visibility === 'PRIVATE') return !!(await getBoardMemberRole(userId, board.id));
  return true;
}

async function canMutateBoard(userId: string, board: BoardRow): Promise<boolean> {
  const role = await getWorkspaceRole(userId, board.workspace_id);
  if (!role) return false;
  if (role === 'OWNER' || role === 'ADMIN') return true;
  if (role === 'VIEWER') return false;
  if (role === 'GUEST') return hasGuestAccess(userId, board.id);
  const boardRole = await getBoardMemberRole(userId, board.id);
  return boardRole === 'ADMIN' || boardRole === 'MEMBER';
}

async function resolveCustomField(id: string): Promise<{ field: CustomFieldRow; board: BoardRow } | null> {
  const field = await db('custom_fields').where({ id }).first() as CustomFieldRow | undefined;
  if (!field) return null;
  const board = await db('boards').where({ id: field.board_id }).first() as BoardRow | undefined;
  if (!board) return null;
  return { field, board };
}

export async function customFieldsRouter(req: AuthenticatedRequest, path: string): Promise<Response | null> {
  const user = getTrelloAuthUser(req);
  if (!user) return TRELLO_PERMISSION_DENIED();

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);

  if (req.method === 'POST' && pathname === '/customFields') {
    const body = await parseBody(req);
    const name = getInput(url, body, 'name');
    const typeInput = getInput(url, body, 'type');
    const idModelInput = getInput(url, body, 'idModel');
    const modelTypeInput = getInput(url, body, 'modelType');
    const posInput = getInput(url, body, 'pos');
    const cardFrontInput = getInput(url, body, 'display_cardFront', 'display.cardFront');

    if (typeof name !== 'string' || !name.trim()) return trelloError('invalid value for name', 400);
    if (typeof typeInput !== 'string' || !CUSTOM_FIELD_TYPES.has(typeInput.trim().toLowerCase())) {
      return trelloError('invalid value for type', 400);
    }
    if (typeof idModelInput !== 'string' || !idModelInput.trim()) return trelloError('invalid value for idModel', 400);
    if (modelTypeInput !== undefined && (typeof modelTypeInput !== 'string' || modelTypeInput.toLowerCase() !== 'board')) {
      return trelloError('invalid value for modelType', 400);
    }

    const boardId = await resolveBoardId(idModelInput);
    if (!boardId) return TRELLO_NOT_FOUND();
    const board = await db('boards').where({ id: boardId }).first() as BoardRow | undefined;
    if (!board) return TRELLO_NOT_FOUND();
    if (!(await canMutateBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

    const id = randomUUID();
    const position = Number(posInput);
    const showOnCard = typeof cardFrontInput === 'boolean'
      ? cardFrontInput
      : typeof cardFrontInput === 'string' && cardFrontInput.toLowerCase() === 'true';
    const fieldType = fieldTypeToDb(typeInput.trim().toLowerCase());

    await db('custom_fields').insert({
      id,
      board_id: board.id,
      name: name.trim(),
      field_type: fieldType,
      options: fieldType === 'DROPDOWN' ? JSON.stringify([]) : null,
      show_on_card: showOnCard,
      position: Number.isFinite(position) ? position : 65535,
      created_at: new Date().toISOString(),
    });

    const created = await db('custom_fields').where({ id }).first() as CustomFieldRow | undefined;
    if (!created) return TRELLO_CUSTOM_FIELD_NOT_FOUND();
    return Response.json(serializeCustomField(created));
  }

  const customFieldMatch = pathname.match(/^\/customFields\/([^/]+)(?:\/(.*))?$/);
  if (!customFieldMatch) return null;

  const customFieldId = customFieldMatch[1] as string;
  const subPath = customFieldMatch[2] ?? '';
  const context = await resolveCustomField(customFieldId);
  if (!context) return TRELLO_CUSTOM_FIELD_NOT_FOUND();

  if (!(await canReadBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();

  if (subPath === '' && req.method === 'GET') {
    return Response.json(serializeCustomField(context.field));
  }

  if (subPath === '' && req.method === 'PUT') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);

    const name = getInput(url, body, 'name');
    const typeInput = getInput(url, body, 'type');
    const posInput = getInput(url, body, 'pos');
    const cardFrontInput = getInput(url, body, 'display_cardFront', 'display.cardFront');

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return trelloError('invalid value for name', 400);
      updates['name'] = name.trim();
    }
    if (typeInput !== undefined) {
      if (typeof typeInput !== 'string' || !CUSTOM_FIELD_TYPES.has(typeInput.trim().toLowerCase())) {
        return trelloError('invalid value for type', 400);
      }
      updates['field_type'] = fieldTypeToDb(typeInput.trim().toLowerCase());
    }
    if (posInput !== undefined) {
      const pos = Number(posInput);
      if (!Number.isFinite(pos)) return trelloError('invalid value for pos', 400);
      updates['position'] = pos;
    }
    if (cardFrontInput !== undefined) {
      if (
        typeof cardFrontInput !== 'boolean'
        && (typeof cardFrontInput !== 'string' || (cardFrontInput.toLowerCase() !== 'true' && cardFrontInput.toLowerCase() !== 'false'))
      ) {
        return trelloError('invalid value for display.cardFront', 400);
      }
      updates['show_on_card'] = typeof cardFrontInput === 'boolean'
        ? cardFrontInput
        : typeof cardFrontInput === 'string' && cardFrontInput.toLowerCase() === 'true';
    }

    if (Object.keys(updates).length > 0) {
      await db('custom_fields').where({ id: context.field.id }).update(updates);
    }
    const updated = await db('custom_fields').where({ id: context.field.id }).first() as CustomFieldRow | undefined;
    if (!updated) return TRELLO_CUSTOM_FIELD_NOT_FOUND();
    return Response.json(serializeCustomField(updated));
  }

  if (subPath === '' && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('card_custom_field_values').where({ custom_field_id: context.field.id }).delete();
    await db('custom_fields').where({ id: context.field.id }).delete();
    return Response.json({});
  }

  if (subPath === 'options' && req.method === 'GET') {
    const serialized = serializeCustomField(context.field);
    return Response.json(serialized.options);
  }

  if (subPath === 'options' && req.method === 'POST') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    if (context.field.field_type !== 'DROPDOWN') return trelloError('invalid value for type', 400);

    const body = await parseBody(req);
    const rawValue = getInput(url, body, 'value');
    const colorInput = getInput(url, body, 'color');

    let textValue: string | null = null;
    if (typeof rawValue === 'string') textValue = rawValue.trim();
    if (rawValue && typeof rawValue === 'object' && typeof (rawValue as { text?: unknown }).text === 'string') {
      textValue = ((rawValue as { text: string }).text).trim();
    }
    if (!textValue) return trelloError('invalid value for value', 400);

    const current = parseCustomFieldOptions(context.field.options);
    const optionId = randomUUID();
    current.push({
      id: optionId,
      value: { text: textValue },
      color: typeof colorInput === 'string' && colorInput.trim() ? colorInput.trim() : null,
    });

    await db('custom_fields').where({ id: context.field.id }).update({ options: JSON.stringify(current) });
    const updated = await db('custom_fields').where({ id: context.field.id }).first() as CustomFieldRow | undefined;
    if (!updated) return TRELLO_CUSTOM_FIELD_NOT_FOUND();
    const serialized = serializeCustomField(updated);
    const option = serialized.options.find((item) => item.id === optionId);
    if (!option) return TRELLO_CUSTOM_FIELD_OPTION_NOT_FOUND();
    return Response.json(option);
  }

  const optionDeleteMatch = subPath.match(/^options\/([^/]+)$/);
  if (optionDeleteMatch && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    if (context.field.field_type !== 'DROPDOWN') return TRELLO_CUSTOM_FIELD_OPTION_NOT_FOUND();

    const optionId = optionDeleteMatch[1] as string;
    const options = parseCustomFieldOptions(context.field.options);
    const next = options.filter((option) => option.id !== optionId);
    if (next.length === options.length) return TRELLO_CUSTOM_FIELD_OPTION_NOT_FOUND();

    await db('custom_fields').where({ id: context.field.id }).update({ options: JSON.stringify(next) });
    await db('card_custom_field_values')
      .where({ custom_field_id: context.field.id, value_option_id: optionId })
      .update({ value_option_id: null });
    return Response.json({});
  }

  return null;
}
