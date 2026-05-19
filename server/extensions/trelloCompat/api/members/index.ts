import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  TRELLO_MEMBER_NOT_FOUND,
  TRELLO_NOT_FOUND,
  TRELLO_PERMISSION_DENIED,
  trelloError,
} from '../../common/errors';
import { getTrelloAuthUser } from '../../middlewares/trelloAuth';
import { serializeBoard } from '../../serializers/board';
import { serializeMember, usernameFromEmail, workspaceRoleToMemberType } from '../../serializers/member';
import { serializeOrganization } from '../../serializers/organization';
import { loadTrelloCardById } from '../cards';

type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';
const ROLE_RANK: Record<MembershipRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
  GUEST: 0,
};

type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
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

type WorkspaceRow = {
  id: string;
  name: string;
  owner_id?: string | null;
  desc?: string | null;
  website?: string | null;
};

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

function highestWorkspaceRole(roles: string[]): MembershipRole | null {
  let highest: MembershipRole | null = null;
  for (const role of roles) {
    if (!(role in ROLE_RANK)) continue;
    const normalized = role as MembershipRole;
    if (!highest || ROLE_RANK[normalized] > ROLE_RANK[highest]) {
      highest = normalized;
    }
  }
  return highest;
}

async function resolveMember(
  identifier: string,
  currentUser: { id: string; email: string; name?: string; avatar_url?: string | null },
): Promise<UserRow | null> {
  if (identifier === 'me') {
    const current = await db('users').where({ id: currentUser.id }).first() as UserRow | undefined;
    if (current) return current;
    return {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name ?? currentUser.email,
      avatar_url: currentUser.avatar_url ?? null,
    };
  }

  const byId = await db('users').where({ id: identifier }).first() as UserRow | undefined;
  if (byId) return byId;

  const users = await db('users') as UserRow[];
  const normalized = identifier.trim().toLowerCase();
  return users.find((user) => usernameFromEmail(user.email) === normalized) ?? null;
}

async function resolveMemberType(userId: string): Promise<ReturnType<typeof workspaceRoleToMemberType>> {
  const memberships = await db('memberships').where({ user_id: userId }).select('role') as Array<{ role: string }>;
  const highest = highestWorkspaceRole(memberships.map((row) => row.role));
  return workspaceRoleToMemberType(highest);
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

  const memberships = boardMembers.map((row) => ({
    id: row.id,
    idMember: row.user_id,
    memberType: (row.role === 'ADMIN'
      ? 'admin'
      : row.role === 'VIEWER'
        ? 'observer'
        : 'normal') as 'admin' | 'normal' | 'observer',
    unconfirmed: false as const,
    deactivated: false as const,
  }));
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

async function listVisibleBoardsForMember(memberId: string): Promise<BoardRow[]> {
  const memberships = await db('memberships').where({ user_id: memberId }) as Array<{ workspace_id: string; role: string }>;
  const roleByWorkspaceId = new Map<string, MembershipRole>();
  for (const row of memberships) {
    const current = roleByWorkspaceId.get(row.workspace_id);
    if (!(row.role in ROLE_RANK)) continue;
    const role = row.role as MembershipRole;
    if (!current || ROLE_RANK[role] > ROLE_RANK[current]) roleByWorkspaceId.set(row.workspace_id, role);
  }

  const boards = await db('boards').orderBy('created_at', 'asc') as BoardRow[];
  const boardMembers = await db('board_members').where({ user_id: memberId }) as Array<{ board_id: string }>;
  const boardGuests = await db('board_guest_access').where({ user_id: memberId }) as Array<{ board_id: string }>;

  const boardMemberIds = new Set(boardMembers.map((row) => row.board_id));
  const boardGuestIds = new Set(boardGuests.map((row) => row.board_id));

  return boards.filter((board) => {
    const role = roleByWorkspaceId.get(board.workspace_id);
    if (!role) return false;
    if (role === 'OWNER' || role === 'ADMIN') return true;

    const visibility = board.visibility ?? 'PRIVATE';
    if (role === 'GUEST') {
      if (visibility === 'PUBLIC') return true;
      return boardGuestIds.has(board.id);
    }

    if (visibility === 'PRIVATE') return boardMemberIds.has(board.id);
    return true;
  });
}

async function listSerializedBoardsForMember(memberId: string) {
  const boards = await listVisibleBoardsForMember(memberId);
  const serialized = [];
  for (const board of boards) {
    const memberships = await listBoardMemberships(board.id);
    const creator = memberships.find((row) => row.memberType === 'admin');
    serialized.push(
      serializeBoard({
        ...board,
        idMemberCreator: creator?.idMember ?? '',
        memberships,
      }),
    );
  }
  return serialized;
}

async function listSerializedCardsForMember(memberId: string, filter: 'open' | 'closed' | 'all') {
  const rows = await db('card_members').where({ user_id: memberId }) as Array<{ card_id: string }>;
  const cards = [];
  for (const row of rows) {
    const card = await loadTrelloCardById(row.card_id);
    if (!card) continue;
    if (filter === 'open' && card.closed) continue;
    if (filter === 'closed' && !card.closed) continue;
    cards.push(card);
  }
  return cards;
}

async function listSerializedOrganizationsForMember(memberId: string) {
  const memberships = await db('memberships')
    .where({ user_id: memberId })
    .orderBy('workspace_id', 'asc') as Array<{ workspace_id: string; role: string }>;
  const visibleMemberships = memberships.filter((row) => row.role !== 'GUEST');
  if (visibleMemberships.length === 0) return [];

  const workspaceIds = new Set(visibleMemberships.map((row) => row.workspace_id));
  const workspaces = await db('workspaces') as WorkspaceRow[];
  const membershipRows = await db('memberships').orderBy('workspace_id', 'asc') as Array<{
    workspace_id: string;
    user_id: string;
    role: string;
  }>;

  return workspaces
    .filter((workspace) => workspaceIds.has(workspace.id))
    .map((workspace) => serializeOrganization({
      ...workspace,
      memberships: membershipRows
        .filter((membership) => membership.workspace_id === workspace.id && membership.role !== 'GUEST')
        .map((membership) => ({ user_id: membership.user_id, role: membership.role })),
    }));
}

export async function membersRouter(req: AuthenticatedRequest, path: string): Promise<Response | null> {
  const user = getTrelloAuthUser(req);
  if (!user) return TRELLO_PERMISSION_DENIED();

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);
  const match = pathname.match(/^\/members\/([^/]+)(?:\/(.*))?$/);
  if (!match) return null;

  const identifier = match[1] as string;
  const subPath = match[2] ?? '';
  const member = await resolveMember(identifier, user);
  if (!member) return TRELLO_MEMBER_NOT_FOUND();
  const fallbackName = member.email.split('@')[0] ?? member.email;
  const memberType = await resolveMemberType(member.id);

  if (subPath === '' && req.method === 'GET') {
    return Response.json(serializeMember({
      id: member.id,
      email: member.email,
      name: member.name ?? fallbackName,
      avatar_url: member.avatar_url ?? null,
      memberType,
    }));
  }

  if (subPath === '' && req.method === 'PUT') {
    if (member.id !== user.id) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const fullName = getInput(url, body, 'fullName');
    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || !fullName.trim()) return trelloError('invalid value for fullName', 400);
      await db('users').where({ id: member.id }).update({ name: fullName.trim() });
    }

    const updated = await db('users').where({ id: member.id }).first() as UserRow | undefined;
    if (!updated) return TRELLO_MEMBER_NOT_FOUND();
    return Response.json(serializeMember({
      id: updated.id,
      email: updated.email,
      name: updated.name ?? fallbackName,
      avatar_url: updated.avatar_url ?? null,
      memberType: await resolveMemberType(updated.id),
    }));
  }

  if (subPath === 'boards' && req.method === 'GET') {
    return Response.json(await listSerializedBoardsForMember(member.id));
  }

  if (subPath === 'cards' && req.method === 'GET') {
    const filter = (url.searchParams.get('filter') ?? 'open') as 'open' | 'closed' | 'all';
    return Response.json(await listSerializedCardsForMember(member.id, filter));
  }

  if (subPath === 'organizations' && req.method === 'GET') {
    return Response.json(await listSerializedOrganizationsForMember(member.id));
  }

  if (subPath === 'notifications' && req.method === 'GET') {
    return Response.json([]);
  }

  if (subPath === 'actions' && req.method === 'GET') {
    return Response.json([]);
  }

  const fieldMatch = subPath.match(/^([a-zA-Z0-9_]+)$/);
  if (fieldMatch && req.method === 'GET') {
    const field = fieldMatch[1] as string;
    const payload = serializeMember({
      id: member.id,
      email: member.email,
      name: member.name ?? fallbackName,
      avatar_url: member.avatar_url ?? null,
      memberType,
    });

    if (field === 'id') return Response.json(payload.id);
    if (field === 'fullName') return Response.json(payload.fullName);
    if (field === 'username') return Response.json(payload.username);
    if (field === 'initials') return Response.json(payload.initials);
    if (field === 'bio') return Response.json(payload.bio);
    if (field === 'memberType') return Response.json(payload.memberType);
    if (field === 'avatarUrl') return Response.json(payload.avatarUrl);
    if (field === 'url') return Response.json(payload.url);
    return TRELLO_NOT_FOUND();
  }

  return null;
}
