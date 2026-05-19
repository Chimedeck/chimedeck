import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import { resolveCardId } from '../../../../common/ids/resolveEntityId';
import { between, HIGH_SENTINEL } from '../../../list/mods/fractional';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  TRELLO_CARD_NOT_FOUND,
  TRELLO_CHECKLIST_NOT_FOUND,
  TRELLO_NOT_FOUND,
  TRELLO_PERMISSION_DENIED,
  trelloError,
} from '../../common/errors';
import { getTrelloAuthUser } from '../../middlewares/trelloAuth';
import { serializeBoard } from '../../serializers/board';
import { serializeCheckItem, serializeChecklist } from '../../serializers/checklist';
import { loadTrelloCardById } from '../cards';

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
  title: string;
  description?: string | null;
  state: 'ACTIVE' | 'ARCHIVED';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'WORKSPACE' | null;
  background?: string | null;
  created_at?: string | Date | null;
};

type ListRow = {
  id: string;
  board_id: string;
};

type CardRow = {
  id: string;
  list_id: string;
};

type ChecklistRow = {
  id: string;
  card_id: string;
  title: string;
  position: string;
};

type CheckItemRow = {
  id: string;
  checklist_id: string;
  card_id: string;
  title: string;
  checked: boolean;
  position: string;
  due_date?: string | Date | null;
  assigned_member_id?: string | null;
};

type ChecklistContext = {
  checklist: ChecklistRow;
  card: CardRow;
  list: ListRow;
  board: BoardRow;
};

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return fallback;
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

async function resolveChecklistContext(checklistId: string): Promise<ChecklistContext | null> {
  const checklist = await db('checklists').where({ id: checklistId }).first() as ChecklistRow | undefined;
  if (!checklist) return null;

  const card = await db('cards').where({ id: checklist.card_id }).first() as CardRow | undefined;
  if (!card) return null;

  const list = await db('lists').where({ id: card.list_id }).first() as ListRow | undefined;
  if (!list) return null;

  const board = await db('boards').where({ id: list.board_id }).first() as BoardRow | undefined;
  if (!board) return null;

  return { checklist, card, list, board };
}

async function resolveChecklistPosition(cardId: string, posValue: unknown, excludeChecklistId?: string): Promise<string> {
  const rows = await db('checklists')
    .where({ card_id: cardId })
    .orderBy('position', 'asc') as ChecklistRow[];
  const checklists = excludeChecklistId ? rows.filter((row) => row.id !== excludeChecklistId) : rows;
  const first = checklists[0];
  const last = checklists.at(-1);

  if (typeof posValue === 'string') {
    const normalized = posValue.trim().toLowerCase();
    if (normalized === 'top') return between('', first?.position ?? HIGH_SENTINEL);
    if (normalized === 'bottom' || normalized === '') return between(last?.position ?? '', HIGH_SENTINEL);

    const asNumber = Number(normalized);
    if (!Number.isNaN(asNumber)) {
      const index = Math.max(0, Math.min(checklists.length, Math.floor(asNumber / 65535)));
      const left = index > 0 ? checklists[index - 1]?.position ?? '' : '';
      const right = index < checklists.length ? checklists[index]?.position ?? HIGH_SENTINEL : HIGH_SENTINEL;
      return between(left, right);
    }
  }

  if (typeof posValue === 'number' && !Number.isNaN(posValue)) {
    const index = Math.max(0, Math.min(checklists.length, Math.floor(posValue / 65535)));
    const left = index > 0 ? checklists[index - 1]?.position ?? '' : '';
    const right = index < checklists.length ? checklists[index]?.position ?? HIGH_SENTINEL : HIGH_SENTINEL;
    return between(left, right);
  }

  return between(last?.position ?? '', HIGH_SENTINEL);
}

async function resolveCheckItemPosition(checklistId: string, posValue: unknown, excludeCheckItemId?: string): Promise<string> {
  const rows = await db('checklist_items')
    .where({ checklist_id: checklistId })
    .orderBy('position', 'asc') as CheckItemRow[];
  const items = excludeCheckItemId ? rows.filter((row) => row.id !== excludeCheckItemId) : rows;
  const first = items[0];
  const last = items.at(-1);

  if (typeof posValue === 'string') {
    const normalized = posValue.trim().toLowerCase();
    if (normalized === 'top') return between('', first?.position ?? HIGH_SENTINEL);
    if (normalized === 'bottom' || normalized === '') return between(last?.position ?? '', HIGH_SENTINEL);

    const asNumber = Number(normalized);
    if (!Number.isNaN(asNumber)) {
      const index = Math.max(0, Math.min(items.length, Math.floor(asNumber / 65535)));
      const left = index > 0 ? items[index - 1]?.position ?? '' : '';
      const right = index < items.length ? items[index]?.position ?? HIGH_SENTINEL : HIGH_SENTINEL;
      return between(left, right);
    }
  }

  if (typeof posValue === 'number' && !Number.isNaN(posValue)) {
    const index = Math.max(0, Math.min(items.length, Math.floor(posValue / 65535)));
    const left = index > 0 ? items[index - 1]?.position ?? '' : '';
    const right = index < items.length ? items[index]?.position ?? HIGH_SENTINEL : HIGH_SENTINEL;
    return between(left, right);
  }

  return between(last?.position ?? '', HIGH_SENTINEL);
}

async function listSerializedCheckItems(checklist: ChecklistRow): Promise<ReturnType<typeof serializeCheckItem>[]> {
  const items = await db('checklist_items')
    .where({ checklist_id: checklist.id, card_id: checklist.card_id })
    .orderBy('position', 'asc') as CheckItemRow[];
  return items.map((item, index) => serializeCheckItem({
    ...item,
    _rank: index,
  }));
}

async function serializeChecklistByRow(checklist: ChecklistRow, boardId: string): Promise<ReturnType<typeof serializeChecklist>> {
  const cardChecklists = await db('checklists')
    .where({ card_id: checklist.card_id })
    .orderBy('position', 'asc') as Array<{ id: string }>;
  const rank = Math.max(0, cardChecklists.findIndex((row) => row.id === checklist.id));
  const checkItems = await listSerializedCheckItems(checklist);
  return serializeChecklist({
    id: checklist.id,
    board_id: boardId,
    card_id: checklist.card_id,
    title: checklist.title,
    _rank: rank,
    checkItems,
  });
}

async function updateChecklist(
  userId: string,
  context: ChecklistContext,
  inputs: { name: unknown; pos: unknown },
): Promise<Response> {
  if (!(await canMutateBoard(userId, context.board))) return TRELLO_PERMISSION_DENIED();

  const updates: Record<string, unknown> = {};
  if (inputs.name !== undefined) {
    if (typeof inputs.name !== 'string' || !inputs.name.trim()) {
      return trelloError('invalid value for name', 400);
    }
    updates['title'] = inputs.name.trim();
  }
  if (inputs.pos !== undefined) {
    updates['position'] = await resolveChecklistPosition(context.checklist.card_id, inputs.pos, context.checklist.id);
  }

  if (Object.keys(updates).length > 0) {
    await db('checklists').where({ id: context.checklist.id }).update(updates);
  }

  const updated = await db('checklists').where({ id: context.checklist.id }).first() as ChecklistRow | undefined;
  if (!updated) return TRELLO_CHECKLIST_NOT_FOUND();

  return Response.json(await serializeChecklistByRow(updated, context.board.id));
}

export async function checklistsRouter(req: AuthenticatedRequest, path: string): Promise<Response | null> {
  const user = getTrelloAuthUser(req);
  if (!user) return TRELLO_PERMISSION_DENIED();

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);

  if (req.method === 'POST' && pathname === '/checklists') {
    const body = await parseBody(req);
    const idCardInput = getInput(url, body, 'idCard');
    const name = getInput(url, body, 'name');
    const pos = getInput(url, body, 'pos');
    const sourceChecklistId = getInput(url, body, 'idChecklistSource');

    if (typeof idCardInput !== 'string' || !idCardInput.trim()) return trelloError('invalid value for idCard', 400);

    const cardId = await resolveCardId(idCardInput);
    if (!cardId) return TRELLO_CARD_NOT_FOUND();

    const card = await db('cards').where({ id: cardId }).first() as CardRow | undefined;
    if (!card) return TRELLO_CARD_NOT_FOUND();
    const list = await db('lists').where({ id: card.list_id }).first() as ListRow | undefined;
    if (!list) return TRELLO_NOT_FOUND();
    const board = await db('boards').where({ id: list.board_id }).first() as BoardRow | undefined;
    if (!board) return TRELLO_NOT_FOUND();
    if (!(await canMutateBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

    let sourceItems: CheckItemRow[] = [];
    if (sourceChecklistId !== undefined) {
      if (typeof sourceChecklistId !== 'string' || !sourceChecklistId.trim()) {
        return trelloError('invalid value for idChecklistSource', 400);
      }
      const sourceChecklist = await db('checklists').where({ id: sourceChecklistId }).first() as ChecklistRow | undefined;
      if (!sourceChecklist) return TRELLO_CHECKLIST_NOT_FOUND();
      sourceItems = await db('checklist_items')
        .where({ checklist_id: sourceChecklist.id })
        .orderBy('position', 'asc') as CheckItemRow[];
    }

    const checklistId = randomUUID();
    const position = await resolveChecklistPosition(card.id, pos);
    await db('checklists').insert({
      id: checklistId,
      card_id: card.id,
      title: typeof name === 'string' && name.trim() ? name.trim() : 'Checklist',
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    let previousPosition = '';
    for (const item of sourceItems) {
      const itemPosition = between(previousPosition, HIGH_SENTINEL);
      previousPosition = itemPosition;
      await db('checklist_items').insert({
        id: randomUUID(),
        checklist_id: checklistId,
        card_id: card.id,
        title: item.title,
        checked: item.checked,
        position: itemPosition,
        due_date: item.due_date ?? null,
        assigned_member_id: item.assigned_member_id ?? null,
      });
    }

    const created = await db('checklists').where({ id: checklistId }).first() as ChecklistRow | undefined;
    if (!created) return TRELLO_CHECKLIST_NOT_FOUND();
    return Response.json(await serializeChecklistByRow(created, board.id));
  }

  const checklistMatch = pathname.match(/^\/checklists\/([^/]+)(?:\/(.*))?$/);
  if (!checklistMatch) return null;

  const checklistIdentifier = checklistMatch[1] as string;
  const subPath = checklistMatch[2] ?? '';
  const context = await resolveChecklistContext(checklistIdentifier);
  if (!context) return TRELLO_CHECKLIST_NOT_FOUND();
  if (!(await canReadBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();

  if (subPath === '' && req.method === 'GET') {
    return Response.json(await serializeChecklistByRow(context.checklist, context.board.id));
  }

  if (subPath === '' && req.method === 'PUT') {
    const body = await parseBody(req);
    return updateChecklist(user.id, context, {
      name: getInput(url, body, 'name'),
      pos: getInput(url, body, 'pos'),
    });
  }

  if (subPath === '' && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('checklists').where({ id: context.checklist.id }).delete();
    return Response.json({});
  }

  if (subPath === 'board' && req.method === 'GET') {
    return Response.json(serializeBoard({ ...context.board, idMemberCreator: '', memberships: [] }));
  }

  if (subPath === 'cards' && req.method === 'GET') {
    const card = await loadTrelloCardById(context.card.id);
    if (!card) return TRELLO_CARD_NOT_FOUND();
    return Response.json([card]);
  }

  if (subPath === 'checkItems' && req.method === 'GET') {
    return Response.json(await listSerializedCheckItems(context.checklist));
  }

  if (subPath === 'checkItems' && req.method === 'POST') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const name = getInput(url, body, 'name');
    const checked = getInput(url, body, 'checked');
    const pos = getInput(url, body, 'pos');
    const due = getInput(url, body, 'due');
    const idMember = getInput(url, body, 'idMember');

    if (typeof name !== 'string' || !name.trim()) return trelloError('invalid value for name', 400);

    const updates: Record<string, unknown> = {};
    if (due !== undefined) {
      if (due === null || due === '') updates['due_date'] = null;
      else if (typeof due === 'string') updates['due_date'] = due;
      else return trelloError('invalid value for due', 400);
    }
    if (idMember !== undefined) {
      if (idMember === null || idMember === '') updates['assigned_member_id'] = null;
      else if (typeof idMember === 'string') updates['assigned_member_id'] = idMember;
      else return trelloError('invalid value for idMember', 400);
    }

    const checkItemId = randomUUID();
    await db('checklist_items').insert({
      id: checkItemId,
      checklist_id: context.checklist.id,
      card_id: context.checklist.card_id,
      title: name.trim(),
      checked: toBoolean(checked, false),
      position: await resolveCheckItemPosition(context.checklist.id, pos),
      due_date: updates['due_date'] ?? null,
      assigned_member_id: updates['assigned_member_id'] ?? null,
    });

    const inserted = await db('checklist_items').where({ id: checkItemId }).first() as CheckItemRow | undefined;
    if (!inserted) return TRELLO_NOT_FOUND();

    const rows = await db('checklist_items')
      .where({ checklist_id: context.checklist.id })
      .orderBy('position', 'asc') as Array<{ id: string }>;
    const rank = Math.max(0, rows.findIndex((row) => row.id === inserted.id));
    return Response.json(serializeCheckItem({ ...inserted, _rank: rank }));
  }

  const checkItemMatch = subPath.match(/^checkItems\/([^/]+)$/);
  if (checkItemMatch && req.method === 'GET') {
    const item = await db('checklist_items')
      .where({ id: checkItemMatch[1], checklist_id: context.checklist.id, card_id: context.checklist.card_id })
      .first() as CheckItemRow | undefined;
    if (!item) return TRELLO_NOT_FOUND();

    const rows = await db('checklist_items')
      .where({ checklist_id: context.checklist.id })
      .orderBy('position', 'asc') as Array<{ id: string }>;
    const rank = Math.max(0, rows.findIndex((row) => row.id === item.id));
    return Response.json(serializeCheckItem({ ...item, _rank: rank }));
  }

  if (checkItemMatch && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('checklist_items')
      .where({ id: checkItemMatch[1], checklist_id: context.checklist.id, card_id: context.checklist.card_id })
      .delete();
    return Response.json({});
  }

  const fieldMatch = subPath.match(/^([a-zA-Z0-9_]+)$/);
  if (fieldMatch && req.method === 'GET') {
    const field = fieldMatch[1] as string;
    if (field === 'name') return Response.json(context.checklist.title);
    if (field === 'idBoard') return Response.json(context.board.id);
    if (field === 'idCard') return Response.json(context.checklist.card_id);
    if (field === 'pos') {
      const payload = await serializeChecklistByRow(context.checklist, context.board.id);
      return Response.json(payload.pos);
    }
    return TRELLO_NOT_FOUND();
  }

  if (fieldMatch && req.method === 'PUT') {
    const field = fieldMatch[1] as string;
    const body = await parseBody(req);
    const value = getInput(url, body, 'value', field);
    if (field === 'name') {
      return updateChecklist(user.id, context, { name: value, pos: undefined });
    }
    if (field === 'pos') {
      return updateChecklist(user.id, context, { name: undefined, pos: value });
    }
    return TRELLO_NOT_FOUND();
  }

  return null;
}
