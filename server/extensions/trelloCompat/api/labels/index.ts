import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import { resolveBoardId } from '../../../../common/ids/resolveEntityId';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  TRELLO_LABEL_NOT_FOUND,
  TRELLO_NOT_FOUND,
  TRELLO_PERMISSION_DENIED,
  trelloError,
} from '../../common/errors';
import { getTrelloAuthUser } from '../../middlewares/trelloAuth';
import { serializeLabel } from '../../serializers/label';

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

type LabelRow = {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
};

function parseColor(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized;
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === 'GET') return {};
  const text = await req.text();
  if (!text.trim()) return {};

  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
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

async function getWorkspaceRole(
  userId: string,
  workspaceId: string
): Promise<MembershipRole | null> {
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

async function getBoardMemberRole(
  userId: string,
  boardId: string
): Promise<'ADMIN' | 'MEMBER' | 'VIEWER' | null> {
  const row = (await db('board_members').where({ user_id: userId, board_id: boardId }).first()) as
    | { role?: string }
    | undefined;
  const role = row?.role;
  if (role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER') return role;
  return null;
}

async function hasGuestAccess(userId: string, boardId: string): Promise<boolean> {
  const row = (await db('board_guest_access')
    .where({ user_id: userId, board_id: boardId })
    .first()) as { id: string } | undefined;
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

async function resolveLabelContext(
  labelId: string
): Promise<{ label: LabelRow; board: BoardRow } | null> {
  const label = (await db('labels').where({ id: labelId }).first()) as LabelRow | undefined;
  if (!label) return null;
  const board = (await db('boards').where({ id: label.board_id }).first()) as BoardRow | undefined;
  if (!board) return null;
  return { label, board };
}

async function updateLabel(
  userId: string,
  label: LabelRow,
  board: BoardRow,
  inputs: { name: unknown; color: unknown }
): Promise<Response> {
  if (!(await canMutateBoard(userId, board))) return TRELLO_PERMISSION_DENIED();

  const updates: Record<string, unknown> = {};
  if (inputs.name !== undefined) {
    if (typeof inputs.name !== 'string' || !inputs.name.trim()) {
      return trelloError('invalid value for name', 400);
    }
    updates['name'] = inputs.name.trim();
  }
  if (inputs.color !== undefined) {
    const color = parseColor(inputs.color);
    if (color === undefined) return trelloError('invalid value for color', 400);
    updates['color'] = color;
  }

  if (Object.keys(updates).length > 0) {
    await db('labels').where({ id: label.id }).update(updates);
  }

  const updated = (await db('labels').where({ id: label.id }).first()) as LabelRow | undefined;
  if (!updated) return TRELLO_LABEL_NOT_FOUND();
  return Response.json(serializeLabel(updated));
}

export async function labelsRouter(
  req: AuthenticatedRequest,
  path: string
): Promise<Response | null> {
  const user = getTrelloAuthUser(req);
  if (!user) return TRELLO_PERMISSION_DENIED();

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);

  if (req.method === 'POST' && pathname === '/labels') {
    const body = await parseBody(req);
    const idBoardInput = getInput(url, body, 'idBoard');
    const name = getInput(url, body, 'name');
    const colorInput = getInput(url, body, 'color');

    if (typeof idBoardInput !== 'string' || !idBoardInput.trim())
      return trelloError('invalid value for idBoard', 400);
    if (typeof name !== 'string' || !name.trim()) return trelloError('invalid value for name', 400);

    const color = parseColor(colorInput);
    if (color === undefined || color === null) return trelloError('invalid value for color', 400);

    const boardId = await resolveBoardId(idBoardInput);
    if (!boardId) return TRELLO_NOT_FOUND();
    const board = (await db('boards').where({ id: boardId }).first()) as BoardRow | undefined;
    if (!board) return TRELLO_NOT_FOUND();
    if (!(await canMutateBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

    const labelId = randomUUID();
    await db('labels').insert({
      id: labelId,
      board_id: board.id,
      name: name.trim(),
      color,
    });

    const created = (await db('labels').where({ id: labelId }).first()) as LabelRow | undefined;
    if (!created) return TRELLO_LABEL_NOT_FOUND();
    return Response.json(serializeLabel(created));
  }

  const labelMatch = pathname.match(/^\/labels\/([^/]+)(?:\/(.*))?$/);
  if (!labelMatch) return null;

  const labelIdentifier = labelMatch[1] as string;
  const subPath = labelMatch[2] ?? '';
  const context = await resolveLabelContext(labelIdentifier);
  if (!context) return TRELLO_LABEL_NOT_FOUND();
  if (!(await canReadBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();

  if (subPath === '' && req.method === 'GET') {
    return Response.json(serializeLabel(context.label));
  }

  if (subPath === '' && req.method === 'PUT') {
    const body = await parseBody(req);
    return updateLabel(user.id, context.label, context.board, {
      name: getInput(url, body, 'name'),
      color: getInput(url, body, 'color'),
    });
  }

  if (subPath === '' && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('card_labels').where({ label_id: context.label.id }).delete();
    await db('labels').where({ id: context.label.id }).delete();
    return Response.json({});
  }

  const fieldMatch = subPath.match(/^([a-zA-Z0-9_]+)$/);
  if (fieldMatch && req.method === 'PUT') {
    const field = fieldMatch[1] as string;
    const body = await parseBody(req);
    const value = getInput(url, body, 'value', field);
    if (field === 'name') {
      return updateLabel(user.id, context.label, context.board, { name: value, color: undefined });
    }
    if (field === 'color') {
      return updateLabel(user.id, context.label, context.board, { name: undefined, color: value });
    }
    return TRELLO_NOT_FOUND();
  }

  return null;
}
