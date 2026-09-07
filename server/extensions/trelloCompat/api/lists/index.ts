import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import { resolveBoardId, resolveListId } from '../../../../common/ids/resolveEntityId';
import { generateUniqueShortId } from '../../../../common/ids/shortId';
import { between, HIGH_SENTINEL } from '../../../list/mods/fractional';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { TRELLO_LIST_NOT_FOUND, TRELLO_NOT_FOUND, TRELLO_PERMISSION_DENIED, trelloError } from '../../common/errors';
import { listTrelloCardsForList } from '../cards';
import { serializeBoard } from '../../serializers/board';
import { serializeList } from '../../serializers/list';
import { getTrelloAuthUser } from '../../middlewares/trelloAuth';

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
  short_id?: string | null;
  board_id: string;
  title: string;
  archived: boolean;
  color?: string | null;
  position: string;
};

type CardRow = {
  id: string;
  list_id: string;
  archived: boolean;
  position: string;
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

async function resolveListRank(boardId: string, listId: string): Promise<number> {
  const boardLists = await db('lists').where({ board_id: boardId }).orderBy('position', 'asc') as ListRow[];
  return Math.max(0, boardLists.findIndex((row) => row.id === listId));
}

async function resolvePositionForBoard(boardId: string, posValue: unknown, excludeListId?: string): Promise<string> {
  const boardLists = await db('lists').where({ board_id: boardId }).orderBy('position', 'asc') as ListRow[];
  const lists = excludeListId ? boardLists.filter((row) => row.id !== excludeListId) : boardLists;
  const first = lists[0];
  const last = lists.at(-1);

  if (typeof posValue === 'string') {
    const normalized = posValue.trim().toLowerCase();
    if (normalized === 'top') return between('', first?.position ?? HIGH_SENTINEL);
    if (normalized === 'bottom' || normalized === '') return between(last?.position ?? '', HIGH_SENTINEL);

    const asNumber = Number(normalized);
    if (!Number.isNaN(asNumber)) {
      const insertIndex = Math.max(0, Math.min(lists.length, Math.floor(asNumber / 65535)));
      const left = insertIndex > 0 ? lists[insertIndex - 1]?.position ?? '' : '';
      const right = insertIndex < lists.length ? lists[insertIndex]?.position ?? HIGH_SENTINEL : HIGH_SENTINEL;
      return between(left, right);
    }
  }

  if (typeof posValue === 'number' && !Number.isNaN(posValue)) {
    const insertIndex = Math.max(0, Math.min(lists.length, Math.floor(posValue / 65535)));
    const left = insertIndex > 0 ? lists[insertIndex - 1]?.position ?? '' : '';
    const right = insertIndex < lists.length ? lists[insertIndex]?.position ?? HIGH_SENTINEL : HIGH_SENTINEL;
    return between(left, right);
  }

  return between(last?.position ?? '', HIGH_SENTINEL);
}

async function updateList(
  userId: string,
  list: ListRow,
  board: BoardRow,
  inputs: {
    name: unknown;
    closed: unknown;
    pos: unknown;
    idBoard: unknown;
  },
): Promise<Response> {
  if (!(await canMutateBoard(userId, board))) return TRELLO_PERMISSION_DENIED();

  let targetBoard = board;
  const updates: Record<string, unknown> = {};

  if (inputs.name !== undefined) {
    if (typeof inputs.name !== 'string' || inputs.name.trim() === '') {
      return trelloError('invalid value for name', 400);
    }
    updates['title'] = inputs.name.trim();
  }

  if (inputs.closed !== undefined) {
    updates['archived'] = toBoolean(inputs.closed);
  }

  if (inputs.idBoard !== undefined) {
    if (typeof inputs.idBoard !== 'string' || inputs.idBoard.trim() === '') {
      return trelloError('invalid value for idBoard', 400);
    }
    const targetBoardId = await resolveBoardId(inputs.idBoard);
    if (!targetBoardId) return TRELLO_NOT_FOUND();
    const resolved = await db('boards').where({ id: targetBoardId }).first() as BoardRow | undefined;
    if (!resolved) return TRELLO_NOT_FOUND();
    if (!(await canMutateBoard(userId, resolved))) return TRELLO_PERMISSION_DENIED();
    targetBoard = resolved;
    updates['board_id'] = resolved.id;
  }

  if (inputs.pos !== undefined || targetBoard.id !== list.board_id) {
    updates['position'] = await resolvePositionForBoard(targetBoard.id, inputs.pos, list.id);
  }

  if (Object.keys(updates).length > 0) {
    await db('lists').where({ id: list.id }).update(updates);
  }

  const updated = await db('lists').where({ id: list.id }).first() as ListRow | undefined;
  if (!updated) return TRELLO_LIST_NOT_FOUND();
  const rank = await resolveListRank(updated.board_id, updated.id);
  return Response.json(serializeList({ ...updated, _rank: rank }));
}

export async function listsRouter(req: AuthenticatedRequest, path: string): Promise<Response | null> {
  const user = getTrelloAuthUser(req);
  if (!user) return TRELLO_PERMISSION_DENIED();

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);

  if (req.method === 'POST' && pathname === '/lists') {
    const body = await parseBody(req);
    const name = getInput(url, body, 'name');
    const idBoardInput = getInput(url, body, 'idBoard');
    const pos = getInput(url, body, 'pos');

    if (typeof name !== 'string' || name.trim() === '') return trelloError('invalid value for name', 400);
    if (typeof idBoardInput !== 'string' || idBoardInput.trim() === '') return trelloError('invalid value for idBoard', 400);

    const boardId = await resolveBoardId(idBoardInput);
    if (!boardId) return TRELLO_NOT_FOUND();
    const board = await db('boards').where({ id: boardId }).first() as BoardRow | undefined;
    if (!board) return TRELLO_NOT_FOUND();
    if (!(await canMutateBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

    const listId = randomUUID();
    const shortId = await generateUniqueShortId('lists');
    const position = await resolvePositionForBoard(board.id, pos);
    await db('lists').insert({
      id: listId,
      short_id: shortId,
      board_id: board.id,
      title: name.trim(),
      archived: false,
      position,
      color: null,
    });

    const created = await db('lists').where({ id: listId }).first() as ListRow | undefined;
    if (!created) return TRELLO_LIST_NOT_FOUND();
    const rank = await resolveListRank(board.id, listId);
    return Response.json(serializeList({ ...created, _rank: rank }));
  }

  const listMatch = pathname.match(/^\/lists\/([^/]+)(?:\/(.*))?$/);
  if (!listMatch) return null;

  const listIdentifier = listMatch[1] as string;
  const subPath = listMatch[2] ?? '';
  const listId = await resolveListId(listIdentifier);
  if (!listId) return TRELLO_LIST_NOT_FOUND();

  const list = await db('lists').where({ id: listId }).first() as ListRow | undefined;
  if (!list) return TRELLO_LIST_NOT_FOUND();
  const board = await db('boards').where({ id: list.board_id }).first() as BoardRow | undefined;
  if (!board) return TRELLO_NOT_FOUND();
  if (!(await canReadBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

  if (subPath === '' && req.method === 'GET') {
    const boardLists = await db('lists').where({ board_id: board.id }).orderBy('position', 'asc') as ListRow[];
    const rank = Math.max(0, boardLists.findIndex((row) => row.id === list.id));
    return Response.json(serializeList({ ...list, _rank: rank }));
  }

  const cardsMatch = subPath.match(/^cards(?:\/(open|closed|all))?$/);
  if (cardsMatch && req.method === 'GET') {
    const filter = (url.searchParams.get('filter') ?? cardsMatch[1] ?? 'open') as 'open' | 'closed' | 'all';
    const cards = await listTrelloCardsForList(list.id, filter);
    return Response.json(cards);
  }

  if (subPath === '' && req.method === 'PUT') {
    const body = await parseBody(req);
    return updateList(user.id, list, board, {
      name: getInput(url, body, 'name'),
      closed: getInput(url, body, 'closed'),
      pos: getInput(url, body, 'pos'),
      idBoard: getInput(url, body, 'idBoard'),
    });
  }

  if (subPath === 'closed' && req.method === 'PUT') {
    const body = await parseBody(req);
    return updateList(user.id, list, board, {
      name: undefined,
      closed: getInput(url, body, 'value', 'closed'),
      pos: undefined,
      idBoard: undefined,
    });
  }

  if (subPath === 'idBoard' && req.method === 'PUT') {
    const body = await parseBody(req);
    return updateList(user.id, list, board, {
      name: undefined,
      closed: undefined,
      pos: undefined,
      idBoard: getInput(url, body, 'value', 'idBoard'),
    });
  }

  if (subPath === 'archiveAllCards' && req.method === 'POST') {
    if (!(await canMutateBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();
    await db('cards')
      .where({ list_id: list.id, archived: false })
      .update({ archived: true, updated_at: new Date().toISOString() });
    return Response.json({});
  }

  if (subPath === 'moveAllCards' && req.method === 'POST') {
    if (!(await canMutateBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const idBoardInput = getInput(url, body, 'idBoard');
    const idListInput = getInput(url, body, 'idList');

    if (typeof idListInput !== 'string' || idListInput.trim() === '') {
      return trelloError('invalid value for idList', 400);
    }

    const targetListId = await resolveListId(idListInput);
    if (!targetListId) return TRELLO_LIST_NOT_FOUND();
    const targetList = await db('lists').where({ id: targetListId }).first() as ListRow | undefined;
    if (!targetList) return TRELLO_LIST_NOT_FOUND();
    const targetBoard = await db('boards').where({ id: targetList.board_id }).first() as BoardRow | undefined;
    if (!targetBoard) return TRELLO_NOT_FOUND();
    if (!(await canMutateBoard(user.id, targetBoard))) return TRELLO_PERMISSION_DENIED();

    if (idBoardInput !== undefined) {
      if (typeof idBoardInput !== 'string' || idBoardInput.trim() === '') {
        return trelloError('invalid value for idBoard', 400);
      }
      const expectedBoardId = await resolveBoardId(idBoardInput);
      if (!expectedBoardId || expectedBoardId !== targetBoard.id) {
        return trelloError('invalid value for idBoard', 400);
      }
    }

    if (targetList.id === list.id) return Response.json({});

    const sourceCards = await db('cards')
      .where({ list_id: list.id, archived: false })
      .orderBy('position', 'asc') as CardRow[];
    const targetCards = await db('cards')
      .where({ list_id: targetList.id, archived: false })
      .orderBy('position', 'asc') as CardRow[];

    let previousPosition = targetCards.at(-1)?.position ?? '';
    for (const card of sourceCards) {
      const position = between(previousPosition, HIGH_SENTINEL);
      previousPosition = position;
      await db('cards')
        .where({ id: card.id })
        .update({
          list_id: targetList.id,
          position,
          updated_at: new Date().toISOString(),
        });
    }

    return Response.json({});
  }

  if (subPath === 'actions' && req.method === 'GET') {
    return Response.json([]);
  }

  if (subPath === 'board' && req.method === 'GET') {
    return Response.json(serializeBoard({ ...board, idMemberCreator: '', memberships: [] }));
  }

  const fieldMatch = subPath.match(/^([a-zA-Z0-9_]+)$/);
  if (fieldMatch && req.method === 'GET') {
    const field = fieldMatch[1] as string;
    if (field === 'name') return Response.json(list.title);
    if (field === 'closed') return Response.json(list.archived);
    if (field === 'idBoard') return Response.json(list.board_id);
    if (field === 'subscribed') return Response.json(false);
    if (field === 'pos') {
      const rank = await resolveListRank(list.board_id, list.id);
      return Response.json(serializeList({ ...list, _rank: rank }).pos);
    }
    return TRELLO_NOT_FOUND();
  }

  if (fieldMatch && req.method === 'PUT') {
    const field = fieldMatch[1] as string;
    const body = await parseBody(req);
    const value = getInput(url, body, 'value');
    if (field === 'name') {
      return updateList(user.id, list, board, { name: value, closed: undefined, pos: undefined, idBoard: undefined });
    }
    if (field === 'closed') {
      return updateList(user.id, list, board, { name: undefined, closed: value, pos: undefined, idBoard: undefined });
    }
    if (field === 'idBoard') {
      return updateList(user.id, list, board, { name: undefined, closed: undefined, pos: undefined, idBoard: value });
    }
    if (field === 'pos') {
      return updateList(user.id, list, board, { name: undefined, closed: undefined, pos: value, idBoard: undefined });
    }
    return TRELLO_NOT_FOUND();
  }

  return null;
}
