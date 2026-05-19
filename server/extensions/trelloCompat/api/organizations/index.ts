import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import type { Role } from '../../../../middlewares/permissionManager';
import { createInvite } from '../../../workspace/mods/invite/create';
import {
  TRELLO_MEMBER_NOT_FOUND,
  TRELLO_NOT_FOUND,
  TRELLO_ORGANIZATION_NOT_FOUND,
  TRELLO_PERMISSION_DENIED,
  trelloError,
} from '../../common/errors';
import { getTrelloAuthUser } from '../../middlewares/trelloAuth';
import { serializeBoard } from '../../serializers/board';
import { serializeMember, workspaceRoleToMemberType } from '../../serializers/member';
import { serializeOrganization } from '../../serializers/organization';

type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';
const ROLE_RANK: Record<MembershipRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
  GUEST: 0,
};

type WorkspaceRow = {
  id: string;
  name: string;
  owner_id?: string | null;
  created_at?: string | Date | null;
  desc?: string | null;
  website?: string | null;
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

type MembershipRow = {
  user_id: string;
  workspace_id: string;
  role: MembershipRole;
};

type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
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

function hasMinRole(role: MembershipRole | null, minRole: MembershipRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

async function getCallerRole(userId: string, workspaceId: string): Promise<MembershipRole | null> {
  const memberships = await db('memberships')
    .where({ user_id: userId, workspace_id: workspaceId })
    .select('role') as Array<{ role: string }>;

  let highest: MembershipRole | null = null;
  for (const membership of memberships) {
    if (!(membership.role in ROLE_RANK)) continue;
    const role = membership.role as MembershipRole;
    if (!highest || ROLE_RANK[role] > ROLE_RANK[highest]) highest = role;
  }
  return highest;
}

async function listOrgMembershipRows(workspaceId: string): Promise<MembershipRow[]> {
  return await db('memberships')
    .where({ workspace_id: workspaceId })
    .orderBy('user_id', 'asc') as MembershipRow[];
}

async function listSerializedBoardMemberships(boardId: string) {
  const boardMembers = await db('board_members')
    .where({ board_id: boardId })
    .orderBy('created_at', 'asc') as Array<{ id: string; user_id: string; role: string }>;
  const guests = await db('board_guest_access')
    .where({ board_id: boardId })
    .orderBy('granted_at', 'asc') as Array<{ id: string; user_id: string }>;

  const memberships = boardMembers.map((membership) => ({
    id: membership.id,
    idMember: membership.user_id,
    memberType: (membership.role === 'ADMIN'
      ? 'admin'
      : membership.role === 'VIEWER'
        ? 'observer'
        : 'normal') as 'admin' | 'normal' | 'observer',
    unconfirmed: false as const,
    deactivated: false as const,
  }));
  for (const guest of guests) {
    memberships.push({
      id: guest.id,
      idMember: guest.user_id,
      memberType: 'observer',
      unconfirmed: false,
      deactivated: false,
    });
  }
  return memberships;
}

function trelloTypeToWorkspaceRole(value: unknown): Role | null {
  if (typeof value !== 'string') return null;
  if (value === 'admin') return 'ADMIN';
  if (value === 'observer') return 'VIEWER';
  if (value === 'normal') return 'MEMBER';
  return null;
}

function serializeOrgMembership(workspaceId: string, membership: { user_id: string; role: string }) {
  const memberType = workspaceRoleToMemberType(membership.role);
  return {
    id: `${workspaceId}-${membership.user_id}`,
    idMember: membership.user_id,
    memberType: memberType === 'ghost' ? 'normal' : memberType,
    unconfirmed: false as const,
    deactivated: false as const,
  };
}

export async function organizationsRouter(req: AuthenticatedRequest, path: string): Promise<Response | null> {
  const user = getTrelloAuthUser(req);
  if (!user) return TRELLO_PERMISSION_DENIED();

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);

  if (req.method === 'POST' && pathname === '/organizations') {
    const body = await parseBody(req);
    const displayName = getInput(url, body, 'displayName');
    if (typeof displayName !== 'string' || !displayName.trim()) {
      return trelloError('invalid value for displayName', 400);
    }

    const workspaceId = randomUUID();
    await db('workspaces').insert({
      id: workspaceId,
      name: displayName.trim(),
      owner_id: user.id,
    });
    await db('memberships').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: 'OWNER',
    });

    const created = await db('workspaces').where({ id: workspaceId }).first() as WorkspaceRow | undefined;
    if (!created) return TRELLO_ORGANIZATION_NOT_FOUND();
    return Response.json(serializeOrganization({
      ...created,
      memberships: [{ user_id: user.id, role: 'OWNER' }],
    }));
  }

  const match = pathname.match(/^\/organizations\/([^/]+)(?:\/(.*))?$/);
  if (!match) return null;

  const organizationId = match[1] as string;
  const subPath = match[2] ?? '';
  const workspace = await db('workspaces').where({ id: organizationId }).first() as WorkspaceRow | undefined;
  if (!workspace) return TRELLO_ORGANIZATION_NOT_FOUND();

  const callerRole = await getCallerRole(user.id, workspace.id);
  if (!callerRole) return TRELLO_PERMISSION_DENIED();

  if (subPath === '' && req.method === 'GET') {
    if (!hasMinRole(callerRole, 'VIEWER')) return TRELLO_PERMISSION_DENIED();
    const memberships = await listOrgMembershipRows(workspace.id);
    return Response.json(serializeOrganization({
      ...workspace,
      memberships: memberships.filter((membership) => membership.role !== 'GUEST'),
    }));
  }

  if (subPath === '' && req.method === 'PUT') {
    if (!hasMinRole(callerRole, 'ADMIN')) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const displayName = getInput(url, body, 'displayName');
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || !displayName.trim()) {
        return trelloError('invalid value for displayName', 400);
      }
      await db('workspaces').where({ id: workspace.id }).update({ name: displayName.trim() });
    }

    const updated = await db('workspaces').where({ id: workspace.id }).first() as WorkspaceRow | undefined;
    if (!updated) return TRELLO_ORGANIZATION_NOT_FOUND();
    const memberships = await listOrgMembershipRows(workspace.id);
    return Response.json(serializeOrganization({
      ...updated,
      memberships: memberships.filter((membership) => membership.role !== 'GUEST'),
    }));
  }

  if (subPath === '' && req.method === 'DELETE') {
    if (!hasMinRole(callerRole, 'OWNER')) return TRELLO_PERMISSION_DENIED();
    await db('workspaces').where({ id: workspace.id }).delete();
    return Response.json({});
  }

  if (subPath === 'boards' && req.method === 'GET') {
    if (!hasMinRole(callerRole, 'VIEWER')) return TRELLO_PERMISSION_DENIED();
    const boards = await db('boards').where({ workspace_id: workspace.id }).orderBy('created_at', 'asc') as BoardRow[];
    const serialized = [];
    for (const board of boards) {
      const memberships = await listSerializedBoardMemberships(board.id);
      const creator = memberships.find((membership) => membership.memberType === 'admin');
      serialized.push(serializeBoard({
        ...board,
        memberships,
        idMemberCreator: creator?.idMember ?? '',
      }));
    }
    return Response.json(serialized);
  }

  if (subPath === 'members' && req.method === 'GET') {
    if (!hasMinRole(callerRole, 'VIEWER')) return TRELLO_PERMISSION_DENIED();
    const memberships = (await listOrgMembershipRows(workspace.id)).filter((membership) => membership.role !== 'GUEST');
    const users = await db('users') as UserRow[];
    const usersById = new Map(users.map((row) => [row.id, row]));

    const result = [];
    for (const membership of memberships) {
      const member = usersById.get(membership.user_id);
      if (!member) continue;
      const fallbackName = member.email.split('@')[0] ?? member.email;
      const memberType = workspaceRoleToMemberType(membership.role);
      result.push(serializeMember({
        id: member.id,
        email: member.email,
        name: member.name ?? fallbackName,
        avatar_url: member.avatar_url ?? null,
        memberType: memberType === 'ghost' ? 'normal' : memberType,
      }));
    }
    return Response.json(result);
  }

  if (subPath === 'members' && req.method === 'PUT') {
    if (!hasMinRole(callerRole, 'ADMIN')) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const email = getInput(url, body, 'email');
    const type = getInput(url, body, 'type');
    if (typeof email !== 'string' || !email.trim()) return trelloError('invalid value for email', 400);
    const role = trelloTypeToWorkspaceRole(type);
    if (!role) return trelloError('invalid value for type', 400);

    const invite = await createInvite({
      workspaceId: workspace.id,
      invitedEmail: email.trim().toLowerCase(),
      role,
    });

    return Response.json({ id: invite.id });
  }

  if (subPath === 'memberships' && req.method === 'GET') {
    if (!hasMinRole(callerRole, 'VIEWER')) return TRELLO_PERMISSION_DENIED();
    const memberships = (await listOrgMembershipRows(workspace.id)).filter((membership) => membership.role !== 'GUEST');
    return Response.json(memberships.map((membership) => serializeOrgMembership(workspace.id, membership)));
  }

  const membershipMatch = subPath.match(/^memberships\/([^/]+)$/);
  if (membershipMatch && req.method === 'GET') {
    if (!hasMinRole(callerRole, 'VIEWER')) return TRELLO_PERMISSION_DENIED();
    const membershipId = membershipMatch[1] as string;
    const userId = membershipId.startsWith(`${workspace.id}-`)
      ? membershipId.slice(`${workspace.id}-`.length)
      : membershipId;
    const membership = await db('memberships')
      .where({ workspace_id: workspace.id, user_id: userId })
      .first() as MembershipRow | undefined;
    if (!membership || membership.role === 'GUEST') return TRELLO_NOT_FOUND();
    return Response.json(serializeOrgMembership(workspace.id, membership));
  }

  const memberMatch = subPath.match(/^members\/([^/]+)$/);
  if (memberMatch && req.method === 'PUT') {
    if (!hasMinRole(callerRole, 'ADMIN')) return TRELLO_PERMISSION_DENIED();
    const memberId = memberMatch[1] as string;
    const targetMembership = await db('memberships')
      .where({ workspace_id: workspace.id, user_id: memberId })
      .first() as MembershipRow | undefined;
    if (!targetMembership) return TRELLO_MEMBER_NOT_FOUND();

    const body = await parseBody(req);
    const type = getInput(url, body, 'type');
    const nextRole = trelloTypeToWorkspaceRole(type);
    if (!nextRole) return trelloError('invalid value for type', 400);

    if (targetMembership.role === 'OWNER' && nextRole !== 'OWNER') {
      const owners = await db('memberships').where({ workspace_id: workspace.id, role: 'OWNER' }) as MembershipRow[];
      if (owners.length <= 1) {
        return trelloError('A workspace must always have at least one Owner. Promote another member first.', 422);
      }
    }

    await db('memberships')
      .where({ workspace_id: workspace.id, user_id: memberId })
      .update({ role: nextRole });

    const updated = await db('memberships')
      .where({ workspace_id: workspace.id, user_id: memberId })
      .first() as MembershipRow | undefined;
    if (!updated) return TRELLO_MEMBER_NOT_FOUND();
    return Response.json(serializeOrgMembership(workspace.id, updated));
  }

  if (memberMatch && req.method === 'DELETE') {
    if (!hasMinRole(callerRole, 'ADMIN')) return TRELLO_PERMISSION_DENIED();
    const memberId = memberMatch[1] as string;
    const targetMembership = await db('memberships')
      .where({ workspace_id: workspace.id, user_id: memberId })
      .first() as MembershipRow | undefined;
    if (!targetMembership) return TRELLO_MEMBER_NOT_FOUND();

    if (targetMembership.role === 'OWNER') {
      const owners = await db('memberships').where({ workspace_id: workspace.id, role: 'OWNER' }) as MembershipRow[];
      if (owners.length <= 1) {
        return trelloError('A workspace must always have at least one Owner. Promote another member first.', 422);
      }
    }

    await db('memberships').where({ workspace_id: workspace.id, user_id: memberId }).delete();
    return Response.json({});
  }

  const fieldMatch = subPath.match(/^([a-zA-Z0-9_]+)$/);
  if (fieldMatch && req.method === 'GET') {
    if (!hasMinRole(callerRole, 'VIEWER')) return TRELLO_PERMISSION_DENIED();
    const field = fieldMatch[1] as string;
    if (field === 'id') return Response.json(workspace.id);
    if (field === 'displayName') return Response.json(workspace.name);
    if (field === 'name') return Response.json(workspace.name.toLowerCase().replace(/\s+/g, ''));
    if (field === 'desc') return Response.json(workspace.desc ?? '');
    if (field === 'website') return Response.json(workspace.website ?? null);
    return TRELLO_NOT_FOUND();
  }

  return null;
}
