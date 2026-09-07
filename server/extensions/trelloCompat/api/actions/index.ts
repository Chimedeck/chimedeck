import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  TRELLO_ACTION_NOT_FOUND,
  TRELLO_ACTION_TEXT_UNSUPPORTED,
  TRELLO_CARD_NOT_FOUND,
  TRELLO_LIST_NOT_FOUND,
  TRELLO_NOT_FOUND,
  TRELLO_PERMISSION_DENIED,
  trelloError,
} from '../../common/errors';
import {
  serializeActivityAction,
  serializeCommentAction,
} from '../../serializers/action';
import { serializeBoard } from '../../serializers/board';
import { serializeList } from '../../serializers/list';
import { serializeMember } from '../../serializers/member';
import { getTrelloAuthUser } from '../../middlewares/trelloAuth';
import { loadTrelloCardById } from '../cards';
import { getActionOrganizationResponse } from './organization';
import {
  createOrGetActionReaction,
  deleteActionReaction,
  getActionReaction,
  listActionReactions,
} from './reactions';
import { getActionReactionsSummary } from './reactionsSummary';

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

type CommentRow = {
  id: string;
  short_id?: string | null;
  card_id: string;
  user_id: string;
  content: string;
  version?: number;
  deleted?: boolean;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
};

type ActivityRow = {
  id: string;
  short_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  board_id?: string | null;
  card_id?: string | null;
  list_id?: string | null;
  actor_id: string;
  action: string;
  payload?: Record<string, unknown> | null;
  created_at?: string | Date | null;
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
  title: string;
  archived: boolean;
  color?: string | null;
  position: string;
};

type CardRow = {
  id: string;
  short_id?: string | null;
  list_id: string;
  title: string;
};

type CommentActionContext = {
  kind: 'comment';
  comment: CommentRow;
  card: CardRow;
  list: ListRow;
  board: BoardRow;
  member: UserRow;
};

type ActivityActionContext = {
  kind: 'activity';
  activity: ActivityRow;
  card: CardRow | null;
  list: ListRow | null;
  board: BoardRow;
  member: UserRow;
};

type ActionContext = CommentActionContext | ActivityActionContext;
const ACTION_RESERVED_SUBPATHS = new Set([
  'text',
  'board',
  'card',
  'list',
  'member',
  'memberCreator',
  'organization',
  'reactions',
  'reactionsSummary',
]);

function toBasicMember(user: UserRow): { id: string; email: string; name: string; avatar_url?: string | null } {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
    avatar_url: user.avatar_url ?? null,
  };
}

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

async function isBoardAdmin(userId: string, board: BoardRow): Promise<boolean> {
  const role = await getWorkspaceRole(userId, board.workspace_id);
  if (role === 'OWNER' || role === 'ADMIN') return true;
  return (await getBoardMemberRole(userId, board.id)) === 'ADMIN';
}

async function findComment(identifier: string): Promise<CommentRow | null> {
  const byId = await db('comments').where({ id: identifier }).first() as CommentRow | undefined;
  if (byId) return byId;
  const all = await db('comments') as CommentRow[];
  return all.find((row) => row.short_id === identifier) ?? null;
}

async function findActivity(identifier: string): Promise<ActivityRow | null> {
  const byId = await db('activities').where({ id: identifier }).first() as ActivityRow | undefined;
  if (byId) return byId;
  const all = await db('activities') as ActivityRow[];
  return all.find((row) => row.short_id === identifier) ?? null;
}

async function resolveCardListBoardFromCardId(cardId: string): Promise<{
  card: CardRow;
  list: ListRow;
  board: BoardRow;
} | null> {
  const card = await db('cards').where({ id: cardId }).first() as CardRow | undefined;
  if (!card) return null;
  const list = await db('lists').where({ id: card.list_id }).first() as ListRow | undefined;
  if (!list) return null;
  const board = await db('boards').where({ id: list.board_id }).first() as BoardRow | undefined;
  if (!board) return null;
  return { card, list, board };
}

async function resolveActionContext(identifier: string): Promise<ActionContext | null> {
  const comment = await findComment(identifier);
  if (comment && !comment.deleted) {
    const related = await resolveCardListBoardFromCardId(comment.card_id);
    if (!related) return null;
    const member = await db('users').where({ id: comment.user_id }).first() as UserRow | undefined;
    if (!member) return null;
    return { kind: 'comment', comment, ...related, member };
  }

  const activity = await findActivity(identifier);
  if (!activity) return null;

  let card: CardRow | null = null;
  let list: ListRow | null = null;
  let board: BoardRow | null = null;

  const explicitCardId =
    activity.card_id
    ?? (activity.entity_type === 'card' ? activity.entity_id ?? null : null);
  if (explicitCardId) {
    const related = await resolveCardListBoardFromCardId(explicitCardId);
    if (related) {
      card = related.card;
      list = related.list;
      board = related.board;
    }
  }

  const explicitListId =
    activity.list_id
    ?? (activity.entity_type === 'list' ? activity.entity_id ?? null : null);
  if (!list && explicitListId) {
    const foundList = await db('lists').where({ id: explicitListId }).first() as ListRow | undefined;
    if (foundList) {
      list = foundList;
      board = await db('boards').where({ id: foundList.board_id }).first() as BoardRow | undefined ?? null;
    }
  }

  const explicitBoardId =
    activity.board_id
    ?? (activity.entity_type === 'board' ? activity.entity_id ?? null : null);
  if (!board && explicitBoardId) {
    board = await db('boards').where({ id: explicitBoardId }).first() as BoardRow | undefined ?? null;
  }

  if (!board) return null;
  const member = await db('users').where({ id: activity.actor_id }).first() as UserRow | undefined;
  if (!member) return null;

  return {
    kind: 'activity',
    activity,
    card,
    list,
    board,
    member,
  };
}

function serializeActionByContext(context: ActionContext) {
  if (context.kind === 'comment') {
    return serializeCommentAction({
      id: context.comment.id,
      card_id: context.card.id,
      board_id: context.board.id,
      list_id: context.list.id,
      user_id: context.comment.user_id,
      content: context.comment.content,
      created_at: context.comment.created_at,
      memberCreator: toBasicMember(context.member),
      cardName: context.card.title,
      boardName: context.board.title,
      listName: context.list.title,
    });
  }

  return serializeActivityAction({
    id: context.activity.id,
    type: context.activity.action,
    card_id: context.card?.id ?? null,
    board_id: context.board.id,
    user_id: context.activity.actor_id,
    payload: {
      ...(context.activity.payload ?? {}),
      ...(context.list ? { list: { id: context.list.id, name: context.list.title } } : {}),
    },
    created_at: context.activity.created_at,
    memberCreator: toBasicMember(context.member),
  });
}

export function projectActionField(
  action: ReturnType<typeof serializeActionByContext>,
  field: string,
): { found: true; value: unknown } | { found: false } {
  if (!Object.prototype.hasOwnProperty.call(action, field)) {
    return { found: false };
  }
  return { found: true, value: (action as Record<string, unknown>)[field] };
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

function canMutateComment(userId: string, context: CommentActionContext, isAdmin: boolean): boolean {
  if (context.comment.user_id === userId) return true;
  return isAdmin;
}

export async function actionsRouter(req: AuthenticatedRequest, path: string): Promise<Response | null> {
  const user = getTrelloAuthUser(req);
  if (!user) return TRELLO_PERMISSION_DENIED();

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);
  const match = pathname.match(/^\/actions\/([^/]+)(?:\/(.*))?$/);
  if (!match) return null;

  const identifier = match[1] as string;
  const subPath = match[2] ?? '';
  const context = await resolveActionContext(identifier);
  if (!context) return TRELLO_ACTION_NOT_FOUND();
  if (!(await canReadBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
  const boardAdmin = await isBoardAdmin(user.id, context.board);

  if (subPath === '' && req.method === 'GET') {
    return Response.json(serializeActionByContext(context));
  }

  if ((subPath === '' || subPath === 'text') && req.method === 'PUT') {
    if (context.kind !== 'comment') return TRELLO_ACTION_TEXT_UNSUPPORTED();
    if (!canMutateComment(user.id, context, boardAdmin)) return TRELLO_PERMISSION_DENIED();

    const body = await parseBody(req);
    const value = getInput(url, body, 'value', 'text');
    if (typeof value !== 'string' || !value.trim()) return trelloError('invalid value for text', 400);

    const currentVersion = typeof context.comment.version === 'number' ? context.comment.version : 1;
    const nextVersion = currentVersion + 1;
    const now = new Date().toISOString();
    await db('comments').where({ id: context.comment.id }).update({
      content: value.trim(),
      version: nextVersion,
      updated_at: now,
    });

    return Response.json(
      serializeCommentAction({
        id: context.comment.id,
        card_id: context.card.id,
        board_id: context.board.id,
        list_id: context.list.id,
        user_id: context.comment.user_id,
        content: value.trim(),
        created_at: now,
        memberCreator: toBasicMember(context.member),
        cardName: context.card.title,
        boardName: context.board.title,
        listName: context.list.title,
      }),
    );
  }

  if (subPath === '' && req.method === 'DELETE') {
    if (context.kind !== 'comment') return TRELLO_ACTION_TEXT_UNSUPPORTED();
    if (!canMutateComment(user.id, context, boardAdmin)) return TRELLO_PERMISSION_DENIED();
    await db('comments').where({ id: context.comment.id }).delete();
    return Response.json({});
  }

  if (subPath === 'board' && req.method === 'GET') {
    const memberships = await listBoardMemberships(context.board.id);
    const creator = memberships.find((row) => row.memberType === 'admin');
    return Response.json(
      serializeBoard({
        ...context.board,
        idMemberCreator: creator?.idMember ?? '',
        memberships,
      }),
    );
  }

  if (subPath === 'card' && req.method === 'GET') {
    const card = context.kind === 'comment' ? context.card : context.card;
    if (!card) return TRELLO_CARD_NOT_FOUND();
    const serialized = await loadTrelloCardById(card.id);
    if (!serialized) return TRELLO_CARD_NOT_FOUND();
    return Response.json(serialized);
  }

  if (subPath === 'list' && req.method === 'GET') {
    const list = context.kind === 'comment' ? context.list : context.list;
    if (!list) return TRELLO_LIST_NOT_FOUND();
    const boardLists = await db('lists')
      .where({ board_id: context.board.id })
      .orderBy('position', 'asc') as ListRow[];
    const rank = Math.max(0, boardLists.findIndex((row) => row.id === list.id));
    return Response.json(serializeList({ ...list, _rank: rank }));
  }

  if ((subPath === 'member' || subPath === 'memberCreator') && req.method === 'GET') {
    return Response.json(serializeMember({
      id: context.member.id,
      email: context.member.email,
      name: context.member.name ?? context.member.email,
      avatar_url: context.member.avatar_url ?? null,
    }));
  }

  if (subPath === 'organization' && req.method === 'GET') {
    return await getActionOrganizationResponse(context.board);
  }

  const fieldMatch = subPath.match(/^([a-zA-Z0-9_]+)$/);
  if (fieldMatch && req.method === 'GET') {
    const field = fieldMatch[1] as string;
    if (!ACTION_RESERVED_SUBPATHS.has(field)) {
      const projection = projectActionField(serializeActionByContext(context), field);
      if (!projection.found) return trelloError('invalid value for field', 400);
      return Response.json(projection.value);
    }
  }

  if (subPath === 'reactions' && req.method === 'GET') {
    if (context.kind !== 'comment') return TRELLO_ACTION_TEXT_UNSUPPORTED();
    return Response.json(await listActionReactions(context.comment.id));
  }

  if (subPath === 'reactions' && req.method === 'POST') {
    if (context.kind !== 'comment') return TRELLO_ACTION_TEXT_UNSUPPORTED();
    const body = await parseBody(req);
    const shortName = getInput(url, body, 'shortName', 'emoji');
    if (typeof shortName !== 'string' || !shortName.trim() || shortName.trim().length > 32) {
      return trelloError('invalid value for shortName', 400);
    }
    return Response.json(await createOrGetActionReaction({
      commentId: context.comment.id,
      emoji: shortName.trim(),
      user,
    }));
  }

  const reactionMatch = subPath.match(/^reactions\/([^/]+)$/);
  if (reactionMatch && req.method === 'GET') {
    if (context.kind !== 'comment') return TRELLO_ACTION_TEXT_UNSUPPORTED();
    const reactionIdentifier = decodeURIComponent(reactionMatch[1] as string);
    const reaction = await getActionReaction(context.comment.id, reactionIdentifier);
    if (!reaction) return TRELLO_NOT_FOUND();
    return Response.json(reaction);
  }

  if (reactionMatch && req.method === 'DELETE') {
    if (context.kind !== 'comment') return TRELLO_ACTION_TEXT_UNSUPPORTED();
    const reactionIdentifier = decodeURIComponent(reactionMatch[1] as string);
    const deletion = await deleteActionReaction({
      commentId: context.comment.id,
      reactionIdentifier,
      callerId: user.id,
      boardAdmin,
    });
    if (!deletion.allowed) return TRELLO_PERMISSION_DENIED();
    return Response.json({});
  }

  if (subPath === 'reactionsSummary' && req.method === 'GET') {
    if (context.kind !== 'comment') return TRELLO_ACTION_TEXT_UNSUPPORTED();
    return Response.json(await getActionReactionsSummary(context.comment.id));
  }

  if (subPath === 'text' && req.method === 'GET') {
    if (context.kind !== 'comment') return TRELLO_ACTION_TEXT_UNSUPPORTED();
    return Response.json(context.comment.content);
  }

  return TRELLO_NOT_FOUND();
}
