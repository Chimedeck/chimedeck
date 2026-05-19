import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  TRELLO_PERMISSION_DENIED,
  trelloError,
} from '../../common/errors';
import { getTrelloAuthUser } from '../../middlewares/trelloAuth';
import { serializeBoard } from '../../serializers/board';
import { serializeMember, usernameFromEmail } from '../../serializers/member';
import { serializeOrganization } from '../../serializers/organization';
import { serializeSearchMembers, serializeSearchResponse } from '../../serializers/search';
import type { TrelloSearchResponse } from '../../types/trello';
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

type ListRow = { id: string; board_id: string };
type CardRow = { id: string; list_id: string; title?: string | null; description?: string | null; archived?: boolean };
type UserRow = { id: string; email: string; name?: string | null; avatar_url?: string | null };
type WorkspaceRow = { id: string; name: string; owner_id?: string | null; desc?: string | null; website?: string | null };

function normalizeQuery(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toPositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

async function getWorkspaceRole(userId: string, workspaceId: string): Promise<MembershipRole | null> {
  const memberships = await db('memberships')
    .where({ user_id: userId, workspace_id: workspaceId })
    .select('role') as Array<Record<string, unknown>>;
  let highest: MembershipRole | null = null;
  for (const row of memberships) {
    const rawRole = row['role'];
    if (typeof rawRole !== 'string' || !(rawRole in ROLE_RANK)) continue;
    const role = rawRole as MembershipRole;
    if (!highest || ROLE_RANK[role] > ROLE_RANK[highest]) highest = role;
  }
  return highest;
}

async function getBoardMemberRole(userId: string, boardId: string): Promise<'ADMIN' | 'MEMBER' | 'VIEWER' | null> {
  const row = await db('board_members').where({ user_id: userId, board_id: boardId }).first() as
    | Record<string, unknown>
    | undefined;
  const role = row?.['role'];
  if (role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER') return role;
  return null;
}

async function hasGuestAccess(userId: string, boardId: string): Promise<boolean> {
  const row = await db('board_guest_access').where({ user_id: userId, board_id: boardId }).first() as
    | Record<string, unknown>
    | undefined;
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

async function listBoardMemberships(boardId: string): Promise<Array<{
  id: string;
  idMember: string;
  memberType: 'admin' | 'normal' | 'observer';
  unconfirmed: false;
  deactivated: false;
}>> {
  const boardMembers = await db('board_members')
    .where({ board_id: boardId })
    .orderBy('created_at', 'asc') as Array<{ id: string; user_id: string; role: string }>;
  const guestRows = await db('board_guest_access')
    .where({ board_id: boardId })
    .orderBy('granted_at', 'asc') as Array<{ id: string; user_id: string }>;

  const memberships = boardMembers.map((row) => {
    const memberType: 'admin' | 'normal' | 'observer' = row.role === 'ADMIN'
      ? 'admin'
      : row.role === 'VIEWER'
        ? 'observer'
        : 'normal';

    return {
      id: row.id,
      idMember: row.user_id,
      memberType,
      unconfirmed: false as const,
      deactivated: false as const,
    };
  });

  for (const row of guestRows) {
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

export type SearchModelType = 'boards' | 'cards' | 'members' | 'organizations';

function splitCsvParam(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function parseSearchModelTypes(params: URLSearchParams): Set<SearchModelType> {
  const rawTokens = splitCsvParam([
    ...params.getAll('modelType'),
    ...params.getAll('modelTypes'),
  ]);
  if (rawTokens.length === 0 || rawTokens.includes('all')) {
    return new Set(['boards', 'cards', 'members', 'organizations']);
  }

  const next = new Set<SearchModelType>();
  for (const token of rawTokens) {
    if (token === 'board' || token === 'boards') next.add('boards');
    if (token === 'card' || token === 'cards') next.add('cards');
    if (token === 'member' || token === 'members') next.add('members');
    if (token === 'organization' || token === 'organizations') next.add('organizations');
  }
  if (next.size === 0) return new Set(['boards', 'cards', 'members', 'organizations']);
  return next;
}

function matchByQuery(query: string, ...values: Array<string | null | undefined>): boolean {
  if (!query) return true;
  return values.some((value) => typeof value === 'string' && value.toLowerCase().includes(query));
}

async function listVisibleBoards(userId: string): Promise<BoardRow[]> {
  const boards = await db('boards').orderBy('created_at', 'asc') as BoardRow[];
  const visible: BoardRow[] = [];
  for (const board of boards) {
    if (await canReadBoard(userId, board)) visible.push(board);
  }
  return visible;
}

async function searchBoards(
  userId: string,
  query: string,
  limit: number,
): Promise<Awaited<ReturnType<typeof serializeBoard>>[]> {
  const visibleBoards = await listVisibleBoards(userId);
  const result = [];
  for (const board of visibleBoards) {
    if (!matchByQuery(query, board.title, board.description)) continue;
    const memberships = await listBoardMemberships(board.id);
    const creator = memberships.find((row) => row.memberType === 'admin');
    result.push(serializeBoard({ ...board, memberships, idMemberCreator: creator?.idMember ?? '' }));
    if (result.length >= limit) break;
  }
  return result;
}

async function searchCards(
  userId: string,
  query: string,
  limit: number,
): Promise<Awaited<ReturnType<typeof loadTrelloCardById>>[]> {
  const visibleBoards = await listVisibleBoards(userId);
  const visibleBoardIds = new Set(visibleBoards.map((board) => board.id));
  const lists = await db('lists') as ListRow[];
  const allowedListIds = new Set(lists.filter((row) => visibleBoardIds.has(row.board_id)).map((row) => row.id));

  const cards = await db('cards').orderBy('created_at', 'asc') as CardRow[];
  const result = [];
  for (const card of cards) {
    if (card.archived) continue;
    if (!allowedListIds.has(card.list_id)) continue;
    if (!matchByQuery(query, card.title, card.description)) continue;
    const serialized = await loadTrelloCardById(card.id);
    if (!serialized) continue;
    result.push(serialized);
    if (result.length >= limit) break;
  }
  return result;
}

async function searchMembers(
  userId: string,
  query: string,
  limit: number,
  prefixOnly = false,
) {
  const visibleBoards = await listVisibleBoards(userId);
  const workspaceIds = new Set(visibleBoards.map((board) => board.workspace_id));

  const memberships = await db('memberships') as Array<{ user_id: string; workspace_id: string }>;
  const memberIds = new Set(
    memberships
      .filter((row) => workspaceIds.has(row.workspace_id))
      .map((row) => row.user_id),
  );

  const users = await db('users').orderBy('email', 'asc') as UserRow[];
  const result = [];
  for (const user of users) {
    if (!memberIds.has(user.id)) continue;
    const username = usernameFromEmail(user.email);
    const fullName = user.name ?? user.email;
    const haystack = [fullName.toLowerCase(), user.email.toLowerCase(), username];
    const matched = prefixOnly
      ? haystack.some((value) => value.startsWith(query))
      : haystack.some((value) => value.includes(query));
    if (!matched) continue;
    result.push(serializeMember({
      id: user.id,
      email: user.email,
      name: fullName,
      avatar_url: user.avatar_url ?? null,
    }));
    if (result.length >= limit) break;
  }
  return result;
}

async function searchOrganizations(
  userId: string,
  query: string,
  limit: number,
) {
  const myMemberships = await db('memberships').where({ user_id: userId }) as Array<{
    workspace_id: string;
    role: string;
  }>;
  const visibleWorkspaceIds = new Set(
    myMemberships.filter((row) => row.role !== 'GUEST').map((row) => row.workspace_id),
  );
  const workspaces = await db('workspaces').orderBy('name', 'asc') as WorkspaceRow[];
  const allMemberships = await db('memberships').orderBy('workspace_id', 'asc') as Array<{
    workspace_id: string;
    user_id: string;
    role: string;
  }>;

  const result = [];
  for (const workspace of workspaces) {
    if (!visibleWorkspaceIds.has(workspace.id)) continue;
    if (!matchByQuery(query, workspace.name, workspace.desc)) continue;
    result.push(
      serializeOrganization({
        ...workspace,
        memberships: allMemberships
          .filter((membership) => membership.workspace_id === workspace.id && membership.role !== 'GUEST')
          .map((membership) => ({ user_id: membership.user_id, role: membership.role })),
      }),
    );
    if (result.length >= limit) break;
  }
  return result;
}

export async function searchRouter(req: AuthenticatedRequest, path: string): Promise<Response | null> {
  const user = getTrelloAuthUser(req);
  if (!user) return TRELLO_PERMISSION_DENIED();

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);

  if (pathname === '/search/members' && req.method === 'GET') {
    const query = normalizeQuery(url.searchParams.get('query'));
    if (!query) return trelloError('invalid value for query', 400);
    const limit = toPositiveInt(url.searchParams.get('limit'), 8);
    return Response.json(serializeSearchMembers(await searchMembers(user.id, query, limit, true)));
  }

  if (pathname !== '/search' || req.method !== 'GET') return null;

  const query = normalizeQuery(url.searchParams.get('query'));
  if (!query) return trelloError('invalid value for query', 400);

  const modelTypes = parseSearchModelTypes(url.searchParams);
  const boardsLimit = toPositiveInt(url.searchParams.get('boards_limit'), 10);
  const cardsLimit = toPositiveInt(url.searchParams.get('cards_limit'), 10);
  const membersLimit = toPositiveInt(url.searchParams.get('members_limit'), 10);
  const organizationsLimit = toPositiveInt(url.searchParams.get('organizations_limit'), 10);

  const response: TrelloSearchResponse = serializeSearchResponse();

  if (modelTypes.has('boards')) response.boards = await searchBoards(user.id, query, boardsLimit);
  if (modelTypes.has('cards')) {
    response.cards = (await searchCards(user.id, query, cardsLimit)).filter(
      (card): card is NonNullable<typeof card> => !!card,
    );
  }
  if (modelTypes.has('members')) response.members = await searchMembers(user.id, query, membersLimit);
  if (modelTypes.has('organizations')) {
    response.organizations = await searchOrganizations(user.id, query, organizationsLimit);
  }

  return Response.json(serializeSearchResponse(response));
}
