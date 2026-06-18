import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import { generateUniqueShortId } from '../../../../common/ids/shortId';
import { resolveBoardId } from '../../../../common/ids/resolveEntityId';
import { between, HIGH_SENTINEL } from '../../../list/mods/fractional';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { TRELLO_NOT_FOUND, TRELLO_PERMISSION_DENIED, trelloError } from '../../common/errors';
import { serializeBoard } from '../../serializers/board';
import { serializeCard as serializeTrelloCard } from '../../serializers/card';
import { serializeLabel } from '../../serializers/label';
import { serializeList } from '../../serializers/list';
import { serializeMember } from '../../serializers/member';
import type { TrelloBoardMembership, TrelloCard } from '../../types/trello';

type TrelloAuthUser = {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string | null;
};

type BoardRow = {
  id: string;
  short_id?: string | null;
  workspace_id: string;
  title: string;
  state: 'ACTIVE' | 'ARCHIVED';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'WORKSPACE' | null;
  description?: string | null;
  background?: string | null;
  created_at?: string | Date | null;
};

type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';
const ROLE_RANK: Record<MembershipRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
  GUEST: 0,
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

function toBoardVisibility(value: unknown): 'PUBLIC' | 'PRIVATE' | 'WORKSPACE' | undefined {
  if (typeof value !== 'string') return undefined;
  if (value === 'public') return 'PUBLIC';
  if (value === 'org') return 'WORKSPACE';
  if (value === 'private') return 'PRIVATE';
  return undefined;
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === 'GET') return {};

  const text = await req.text();
  if (!text.trim()) return {};

  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
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

async function isBoardMember(userId: string, boardId: string): Promise<boolean> {
  const row = await db('board_members').where({ user_id: userId, board_id: boardId }).first();
  return !!row;
}

async function hasBoardAdminRole(userId: string, boardId: string): Promise<boolean> {
  const row = await db('board_members').where({ user_id: userId, board_id: boardId }).first();
  return row?.role === 'ADMIN';
}

async function hasGuestAccess(userId: string, boardId: string): Promise<boolean> {
  const row = await db('board_guest_access').where({ user_id: userId, board_id: boardId }).first();
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

  if (visibility === 'PRIVATE') {
    return isBoardMember(userId, board.id);
  }

  return true;
}

async function canWriteBoard(userId: string, board: BoardRow): Promise<boolean> {
  const role = await getWorkspaceRole(userId, board.workspace_id);
  if (role === 'OWNER' || role === 'ADMIN') return true;
  return hasBoardAdminRole(userId, board.id);
}

async function loadBoard(boardIdentifier: string): Promise<BoardRow | null> {
  const boardId = await resolveBoardId(boardIdentifier);
  if (!boardId) return null;
  return (await db('boards').where({ id: boardId }).first()) as BoardRow | null;
}

async function listBoardMemberships(boardId: string): Promise<TrelloBoardMembership[]> {
  const boardMembers = await db('board_members')
    .where({ board_id: boardId })
    .orderBy('created_at', 'asc');
  const guestRows = await db('board_guest_access')
    .where({ board_id: boardId })
    .orderBy('granted_at', 'asc');

  const memberships: TrelloBoardMembership[] = (
    boardMembers as Array<{ id: string; user_id: string; role: string }>
  ).map((row) => ({
    id: row.id,
    idMember: row.user_id,
    memberType: row.role === 'ADMIN' ? 'admin' : 'normal',
    unconfirmed: false,
    deactivated: false,
  }));

  for (const row of guestRows as Array<{ id: string; user_id: string }>) {
    memberships.push({
      id: row.id,
      idMember: row.user_id,
      memberType: 'observer',
      unconfirmed: false,
      deactivated: false,
    });
  }

  return memberships;
}

async function resolveBoardCreatorId(boardId: string): Promise<string> {
  const admin = await db('board_members')
    .where({ board_id: boardId })
    .orderBy('created_at', 'asc')
    .first();
  return (admin?.user_id as string | undefined) ?? '';
}

function serializeCard(card: {
  id: string;
  short_id?: string | null;
  title: string;
  description?: string | null;
  list_id: string;
  archived: boolean;
  due_date?: string | Date | null;
  due_complete?: boolean | null;
  start_date?: string | Date | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  board_id: string;
  labels: Array<{ id: string; board_id: string; name: string; color: string }>;
  memberIds: string[];
  checklistIds: string[];
  rank: number;
}): TrelloCard {
  return serializeTrelloCard({
    id: card.id,
    short_id: card.short_id ?? null,
    title: card.title,
    description: card.description ?? null,
    list_id: card.list_id,
    archived: card.archived,
    due_date: card.due_date ?? null,
    due_complete: !!card.due_complete,
    start_date: card.start_date ?? null,
    created_at: card.created_at ?? null,
    updated_at: card.updated_at ?? null,
    board_id: card.board_id,
    labels: card.labels.map((label) => serializeLabel(label)),
    members: card.memberIds.map((user_id) => ({ user_id })),
    checklists: card.checklistIds.map((id) => ({ id })),
    checkItemCount: card.checklistIds.length,
    checkItemsChecked: 0,
    _rank: card.rank,
  });
}

async function listCardsForBoard(
  boardId: string,
  filter: 'open' | 'closed' | 'all'
): Promise<TrelloCard[]> {
  const lists = await db('lists').where({ board_id: boardId }).orderBy('position', 'asc');
  const listIds = new Set((lists as Array<{ id: string }>).map((row) => row.id));
  if (listIds.size === 0) return [];

  const allCards = await db('cards').orderBy('position', 'asc');
  const cards = (
    allCards as Array<{
      id: string;
      short_id?: string | null;
      list_id: string;
      title: string;
      description?: string | null;
      archived: boolean;
      due_date?: string | Date | null;
      due_complete?: boolean | null;
      start_date?: string | Date | null;
      created_at?: string | Date | null;
      updated_at?: string | Date | null;
    }>
  ).filter((row) => listIds.has(row.list_id));

  const filteredCards = cards.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'closed') return row.archived;
    return !row.archived;
  });

  const cardIds = new Set(filteredCards.map((row) => row.id));
  const cardLabels = await db('card_labels');
  const labels = await db('labels');
  const cardMembers = await db('card_members');
  const checklists = await db('checklists');

  const labelsById = new Map(
    (labels as Array<{ id: string; board_id: string; name: string; color: string }>).map((row) => [
      row.id,
      row,
    ])
  );
  const labelsByCardId = new Map<
    string,
    Array<{ id: string; board_id: string; name: string; color: string }>
  >();
  for (const row of cardLabels as Array<{ card_id: string; label_id: string }>) {
    if (!cardIds.has(row.card_id)) continue;
    const label = labelsById.get(row.label_id);
    if (!label) continue;
    const current = labelsByCardId.get(row.card_id) ?? [];
    current.push(label);
    labelsByCardId.set(row.card_id, current);
  }

  const membersByCardId = new Map<string, string[]>();
  for (const row of cardMembers as Array<{ card_id: string; user_id: string }>) {
    if (!cardIds.has(row.card_id)) continue;
    const current = membersByCardId.get(row.card_id) ?? [];
    current.push(row.user_id);
    membersByCardId.set(row.card_id, current);
  }

  const checklistByCardId = new Map<string, string[]>();
  for (const row of checklists as Array<{ id: string; card_id: string }>) {
    if (!cardIds.has(row.card_id)) continue;
    const current = checklistByCardId.get(row.card_id) ?? [];
    current.push(row.id);
    checklistByCardId.set(row.card_id, current);
  }

  return filteredCards.map((row, index) =>
    serializeCard({
      ...row,
      board_id: boardId,
      labels: labelsByCardId.get(row.id) ?? [],
      memberIds: membersByCardId.get(row.id) ?? [],
      checklistIds: checklistByCardId.get(row.id) ?? [],
      rank: index,
    })
  );
}

export async function boardsRouter(
  req: AuthenticatedRequest,
  path: string
): Promise<Response | null> {
  const user = req.currentUser as TrelloAuthUser | undefined;
  if (!user) return trelloError('invalid token', 401);

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);

  if (req.method === 'POST' && (pathname === '/boards' || path === '/boards/')) {
    const body = await parseBody(req);
    const name = getInput(url, body, 'name');
    const idOrganization = getInput(url, body, 'idOrganization');
    const desc = getInput(url, body, 'desc');
    const permissionLevel = getInput(url, body, 'prefs_permissionLevel', 'prefs/permissionLevel');
    const background = getInput(url, body, 'prefs_background', 'prefs/background');
    const defaultLists = getInput(url, body, 'defaultLists');

    if (typeof name !== 'string' || name.trim() === '') {
      return trelloError('invalid value for name', 400);
    }
    if (typeof idOrganization !== 'string' || idOrganization.trim() === '') {
      return trelloError('invalid value for idOrganization', 400);
    }

    const workspaceRole = await getWorkspaceRole(user.id, idOrganization);
    if (workspaceRole !== 'OWNER' && workspaceRole !== 'ADMIN') {
      return TRELLO_PERMISSION_DENIED();
    }

    const boardId = randomUUID();
    const boardShortId = await generateUniqueShortId('boards');
    const visibility = toBoardVisibility(permissionLevel) ?? 'PRIVATE';

    await db('boards').insert({
      id: boardId,
      short_id: boardShortId,
      workspace_id: idOrganization,
      title: name.trim(),
      description: typeof desc === 'string' ? desc : null,
      state: 'ACTIVE',
      visibility,
      background: typeof background === 'string' ? background : null,
    });

    await db('board_members').insert({
      id: randomUUID(),
      board_id: boardId,
      user_id: user.id,
      role: 'ADMIN',
    });

    if (toBoolean(defaultLists, true)) {
      const titles = ['To Do', 'In Progress', 'Done'];
      let previousPosition = '';
      for (const title of titles) {
        const listId = randomUUID();
        const shortId = await generateUniqueShortId('lists');
        const position = between(previousPosition, HIGH_SENTINEL);
        previousPosition = position;
        await db('lists').insert({
          id: listId,
          short_id: shortId,
          board_id: boardId,
          title,
          position,
          archived: false,
        });
      }
    }

    const board = await db('boards').where({ id: boardId }).first();
    const memberships = await listBoardMemberships(boardId);
    return Response.json(
      serializeBoard({
        ...(board as BoardRow),
        idMemberCreator: user.id,
        memberships,
      }),
      { status: 200 }
    );
  }

  const boardMatch = pathname.match(/^\/boards\/([^/]+)(?:\/(.*))?$/);
  if (!boardMatch) return null;

  const boardIdentifier = boardMatch[1] as string;
  const subPath = boardMatch[2] ?? '';
  const board = await loadBoard(boardIdentifier);
  if (!board) return TRELLO_NOT_FOUND();

  if (!(await canReadBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

  if (subPath === '' && req.method === 'GET') {
    const memberships = await listBoardMemberships(board.id);
    const idMemberCreator = await resolveBoardCreatorId(board.id);
    return Response.json(serializeBoard({ ...board, memberships, idMemberCreator }));
  }

  if (subPath === '' && req.method === 'PUT') {
    if (!(await canWriteBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

    const body = await parseBody(req);
    const name = getInput(url, body, 'name');
    const desc = getInput(url, body, 'desc');
    const closed = getInput(url, body, 'closed');
    const permissionLevel = getInput(url, body, 'prefs_permissionLevel', 'prefs/permissionLevel');
    const background = getInput(url, body, 'prefs_background', 'prefs/background');

    const updates: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim() !== '') updates['title'] = name.trim();
    if (typeof desc === 'string') updates['description'] = desc;
    if (closed !== undefined) updates['state'] = toBoolean(closed) ? 'ARCHIVED' : 'ACTIVE';

    const visibility = toBoardVisibility(permissionLevel);
    if (visibility) updates['visibility'] = visibility;
    if (typeof background === 'string') updates['background'] = background;

    if (Object.keys(updates).length > 0) {
      await db('boards').where({ id: board.id }).update(updates);
    }

    const updated = await db('boards').where({ id: board.id }).first();
    const memberships = await listBoardMemberships(board.id);
    const idMemberCreator = await resolveBoardCreatorId(board.id);
    return Response.json(
      serializeBoard({ ...(updated as BoardRow), memberships, idMemberCreator })
    );
  }

  if (subPath === '' && req.method === 'DELETE') {
    if (!(await canWriteBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();
    await db('boards').where({ id: board.id }).delete();
    return Response.json({});
  }

  const listPathMatch = subPath.match(/^lists(?:\/(open|closed|all))?$/);
  if (listPathMatch && req.method === 'GET') {
    const filter = (url.searchParams.get('filter') ?? listPathMatch[1] ?? 'open') as
      | 'open'
      | 'closed'
      | 'all';
    const lists = await db('lists').where({ board_id: board.id }).orderBy('position', 'asc');

    const filtered = (
      lists as Array<{
        id: string;
        board_id: string;
        title: string;
        archived: boolean;
        color?: string | null;
      }>
    )
      .filter((row) => {
        if (filter === 'all') return true;
        if (filter === 'closed') return row.archived;
        return !row.archived;
      })
      .map((row, index) => serializeList({ ...row, _rank: index }));

    return Response.json(filtered);
  }

  if (subPath === 'lists' && req.method === 'POST') {
    if (!(await canWriteBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const name = getInput(url, body, 'name');
    if (typeof name !== 'string' || name.trim() === '') {
      return trelloError('invalid value for name', 400);
    }

    const existing = await db('lists').where({ board_id: board.id }).orderBy('position', 'asc');
    const last = (existing as Array<{ position: string }>).at(-1);
    const listId = randomUUID();
    const shortId = await generateUniqueShortId('lists');
    const position = between(last?.position ?? '', HIGH_SENTINEL);

    await db('lists').insert({
      id: listId,
      short_id: shortId,
      board_id: board.id,
      title: name.trim(),
      position,
      archived: false,
    });

    const created = await db('lists').where({ id: listId }).first();
    return Response.json(
      serializeList({
        ...(created as {
          id: string;
          board_id: string;
          title: string;
          archived: boolean;
          color?: string | null;
        }),
        _rank: existing.length,
      }),
      { status: 200 }
    );
  }

  const cardsPathMatch = subPath.match(/^cards(?:\/(open|closed|all))?$/);
  if (cardsPathMatch && req.method === 'GET') {
    const filter = (url.searchParams.get('filter') ?? cardsPathMatch[1] ?? 'open') as
      | 'open'
      | 'closed'
      | 'all';
    const cards = await listCardsForBoard(board.id, filter);
    return Response.json(cards);
  }

  if (subPath === 'members' && req.method === 'GET') {
    const boardMembers = await db('board_members')
      .where({ board_id: board.id })
      .orderBy('created_at', 'asc');
    const guestRows = await db('board_guest_access')
      .where({ board_id: board.id })
      .orderBy('granted_at', 'asc');

    const membersById = new Map<string, 'admin' | 'normal' | 'observer'>();
    for (const row of boardMembers as Array<{ user_id: string; role: string }>) {
      membersById.set(row.user_id, row.role === 'ADMIN' ? 'admin' : 'normal');
    }
    for (const row of guestRows as Array<{ user_id: string }>) {
      if (!membersById.has(row.user_id)) membersById.set(row.user_id, 'observer');
    }

    const result = [];
    for (const [memberId, memberType] of membersById.entries()) {
      const dbUser = await db('users').where({ id: memberId }).first();
      if (!dbUser) continue;
      result.push(
        serializeMember({
          id: dbUser.id as string,
          email: (dbUser.email as string) ?? '',
          name: (dbUser.name as string) ?? (dbUser.email as string),
          avatar_url: (dbUser.avatar_url as string | null | undefined) ?? null,
          memberType,
        })
      );
    }

    return Response.json(result);
  }

  const memberMatch = subPath.match(/^members\/([^/]+)$/);
  if (memberMatch && req.method === 'PUT') {
    if (!(await canWriteBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

    const idMember = memberMatch[1] as string;
    const body = await parseBody(req);
    const typeValue = getInput(url, body, 'type');
    const memberType = typeof typeValue === 'string' ? typeValue : 'normal';

    const targetUser = await db('users').where({ id: idMember }).first();
    if (!targetUser) return TRELLO_NOT_FOUND();

    const workspaceRole = await getWorkspaceRole(idMember, board.workspace_id);
    if (!workspaceRole) return TRELLO_PERMISSION_DENIED();

    const boardRole = memberType === 'admin' ? 'ADMIN' : 'MEMBER';
    const existingBoardMembership = await db('board_members')
      .where({ board_id: board.id, user_id: idMember })
      .first();

    if (existingBoardMembership) {
      await db('board_members')
        .where({ board_id: board.id, user_id: idMember })
        .update({ role: boardRole, updated_at: new Date().toISOString() });
    } else {
      await db('board_members').insert({
        id: randomUUID(),
        board_id: board.id,
        user_id: idMember,
        role: boardRole,
      });
    }

    const saved = await db('board_members')
      .where({ board_id: board.id, user_id: idMember })
      .first();

    return Response.json({
      id: (saved?.id as string) ?? randomUUID(),
      idMember: idMember,
      memberType: boardRole === 'ADMIN' ? 'admin' : 'normal',
      unconfirmed: false,
      deactivated: false,
    });
  }

  if (memberMatch && req.method === 'DELETE') {
    if (!(await canWriteBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

    const idMember = memberMatch[1] as string;
    const existing = await db('board_members')
      .where({ board_id: board.id, user_id: idMember })
      .first();
    const guest = await db('board_guest_access')
      .where({ board_id: board.id, user_id: idMember })
      .first();
    if (!existing && !guest) return TRELLO_NOT_FOUND();

    await db('board_members').where({ board_id: board.id, user_id: idMember }).delete();
    await db('board_guest_access').where({ board_id: board.id, user_id: idMember }).delete();
    return Response.json({});
  }

  if (subPath === 'labels' && req.method === 'GET') {
    const labels = await db('labels').where({ board_id: board.id }).orderBy('name', 'asc');
    return Response.json(
      (labels as Array<{ id: string; board_id: string; name: string; color: string }>).map(
        (label) => serializeLabel(label)
      )
    );
  }

  if (subPath === 'labels' && req.method === 'POST') {
    if (!(await canWriteBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const name = getInput(url, body, 'name');
    const color = getInput(url, body, 'color');
    if (typeof name !== 'string' || name.trim() === '') {
      return trelloError('invalid value for name', 400);
    }

    const label = {
      id: randomUUID(),
      board_id: board.id,
      name: name.trim(),
      color: typeof color === 'string' && color.trim() ? color : 'green',
    };
    await db('labels').insert(label);
    return Response.json(serializeLabel(label));
  }

  if (subPath === 'memberships' && req.method === 'GET') {
    const memberships = await listBoardMemberships(board.id);
    return Response.json(memberships);
  }

  if (subPath === 'actions' && req.method === 'GET') {
    return Response.json([]);
  }

  const fieldMatch = subPath.match(/^([a-zA-Z0-9_]+)$/);
  if (fieldMatch && req.method === 'GET') {
    const field = fieldMatch[1] as string;
    if (field === 'name') return Response.json(board.title);
    if (field === 'desc') return Response.json(board.description ?? '');
    if (field === 'closed') return Response.json(board.state === 'ARCHIVED');
    if (field === 'idOrganization') return Response.json(board.workspace_id);
    if (field === 'url') return Response.json(`/trello/1/boards/${board.id}`);
    return TRELLO_NOT_FOUND();
  }

  return null;
}
