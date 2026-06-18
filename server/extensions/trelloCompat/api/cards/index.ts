import { randomUUID } from 'node:crypto';
import { db } from '../../../../common/db';
import {
  resolveBoardId,
  resolveCardId,
  resolveListId,
} from '../../../../common/ids/resolveEntityId';
import { generateUniqueShortId } from '../../../../common/ids/shortId';
import { between, HIGH_SENTINEL } from '../../../list/mods/fractional';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  TRELLO_CARD_NOT_FOUND,
  TRELLO_COMMENT_NOT_FOUND,
  TRELLO_CUSTOM_FIELD_NOT_FOUND,
  TRELLO_LIST_NOT_FOUND,
  TRELLO_NOT_FOUND,
  TRELLO_PERMISSION_DENIED,
  trelloError,
} from '../../common/errors';
import { serializeAction } from '../../serializers/action';
import { serializeBoard } from '../../serializers/board';
import { serializeCard } from '../../serializers/card';
import { serializeCheckItem, serializeChecklist } from '../../serializers/checklist';
import { serializeCustomFieldItem } from '../../serializers/customField';
import { serializeLabel } from '../../serializers/label';
import { serializeList } from '../../serializers/list';
import { serializeMember } from '../../serializers/member';
import { getTrelloAuthUser } from '../../middlewares/trelloAuth';
import type { TrelloCard } from '../../types/trello';
import { validateCardMove } from '../../../stateTransitions/enforcement';
import { StateTransitionForbiddenError } from '../../../stateTransitions/common/errors';
import { toTrelloStateTransitionForbiddenResponse } from '../../cardMove';

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
  description?: string | null;
  archived: boolean;
  due_date?: string | Date | null;
  due_complete?: boolean | null;
  start_date?: string | Date | null;
  cover_attachment_id?: string | null;
  cover_color?: string | null;
  cover_size?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  position: string;
};

type LabelRow = { id: string; board_id: string; name: string; color: string };
type UserRow = { id: string; email: string; name?: string | null; avatar_url?: string | null };

type CardContext = {
  card: CardRow;
  list: ListRow;
  board: BoardRow;
};

type HydratedCard = {
  card: CardRow;
  list: ListRow;
  board: BoardRow;
  labels: LabelRow[];
  members: Array<{ user_id: string }>;
  checklists: Array<{ id: string }>;
  attachmentCount: number;
  commentCount: number;
  checkItemCount: number;
  checkItemsChecked: number;
  customFieldItems: Array<{
    id: string;
    card_id: string;
    custom_field_id: string;
    value_text?: string | null;
    value_number?: number | string | null;
    value_date?: string | Date | null;
    value_checkbox?: boolean | null;
    value_option_id?: string | null;
    field_type?: string;
  }>;
};

type CustomFieldRow = {
  id: string;
  board_id: string;
  field_type: 'TEXT' | 'NUMBER' | 'DATE' | 'CHECKBOX' | 'DROPDOWN';
  options?:
    | Array<{ id: string; value?: string | { text?: string } | null; color?: string | null }>
    | string
    | null;
};

type PluginDataRow = {
  plugin_id?: string | null;
  scope?: string | null;
  resource_id?: string | null;
  board_id?: string | null;
  user_id?: string | null;
  value?: unknown;
};

type PluginDataVisibility = 'private' | 'shared' | 'public';

function parsePluginDataValue(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function resolvePluginDataVisibility(row: PluginDataRow): PluginDataVisibility {
  if (row.user_id) return 'private';

  const parsed = parsePluginDataValue(row.value);
  if (parsed && typeof parsed === 'object') {
    const payload = parsed as Record<string, unknown>;
    const scope = typeof payload.scope === 'string' ? payload.scope : undefined;
    const visibility = typeof payload.visibility === 'string' ? payload.visibility : undefined;
    const normalized = (scope ?? visibility)?.trim().toLowerCase();
    if (normalized === 'public') return 'public';
    if (normalized === 'shared') return 'shared';
    if (normalized === 'private') return 'private';
  }

  return 'shared';
}

function toPluginDataValueString(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string') return raw;
  return JSON.stringify(raw);
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
  }
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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

function parseCustomFieldOptions(raw: unknown): Array<{ id: string }> {
  if (Array.isArray(raw))
    return raw.filter((row): row is { id: string } => !!row && typeof row.id === 'string');
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (row): row is { id: string } => !!row && typeof (row as { id?: unknown }).id === 'string'
        );
      }
    } catch {
      return [];
    }
  }
  return [];
}

function buildCustomFieldValuePatch(
  fieldType: CustomFieldRow['field_type'],
  value: unknown,
  fieldOptions: CustomFieldRow['options']
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const base = {
    value_text: null,
    value_number: null,
    value_date: null,
    value_checkbox: null,
    value_option_id: null,
  };

  if (fieldType === 'TEXT') {
    if (typeof payload.text !== 'string') return null;
    return { ...base, value_text: payload.text };
  }
  if (fieldType === 'NUMBER') {
    const numberValue =
      typeof payload.number === 'number' ? payload.number : Number(payload.number);
    if (!Number.isFinite(numberValue)) return null;
    return { ...base, value_number: numberValue };
  }
  if (fieldType === 'DATE') {
    if (typeof payload.date !== 'string' || !payload.date.trim()) return null;
    const parsed = new Date(payload.date);
    if (Number.isNaN(parsed.getTime())) return null;
    return { ...base, value_date: parsed.toISOString() };
  }
  if (fieldType === 'CHECKBOX') {
    const checked = payload.checked;
    if (checked === undefined) return null;
    return { ...base, value_checkbox: toBoolean(checked) };
  }

  const optionId =
    typeof payload.optionId === 'string'
      ? payload.optionId
      : typeof payload.idValue === 'string'
        ? payload.idValue
        : null;
  if (!optionId) return null;
  const options = parseCustomFieldOptions(fieldOptions);
  if (!options.some((option) => option.id === optionId)) return null;
  return { ...base, value_option_id: optionId };
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
  const row = await db('board_members').where({ user_id: userId, board_id: boardId }).first();
  const role = row?.role as string | undefined;
  if (role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER') return role;
  return null;
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

async function resolveCardContext(cardIdentifier: string): Promise<CardContext | null> {
  const cardId = await resolveCardId(cardIdentifier);
  if (!cardId) return null;
  const card = (await db('cards').where({ id: cardId }).first()) as CardRow | undefined;
  if (!card) return null;
  const list = (await db('lists').where({ id: card.list_id }).first()) as ListRow | undefined;
  if (!list) return null;
  const board = (await db('boards').where({ id: list.board_id }).first()) as BoardRow | undefined;
  if (!board) return null;
  return { card, list, board };
}

async function resolvePositionForList(listId: string, posValue: unknown): Promise<string> {
  const cards = (await db('cards')
    .where({ list_id: listId, archived: false })
    .orderBy('position', 'asc')) as CardRow[];
  const first = cards[0];
  const last = cards.at(-1);

  if (typeof posValue === 'string') {
    const normalized = posValue.trim().toLowerCase();
    if (normalized === 'top') return between('', first?.position ?? HIGH_SENTINEL);
    if (normalized === 'bottom' || normalized === '')
      return between(last?.position ?? '', HIGH_SENTINEL);

    const asNumber = Number(normalized);
    if (!Number.isNaN(asNumber)) {
      const insertIndex = Math.max(0, Math.min(cards.length, Math.floor(asNumber / 65535)));
      const left = insertIndex > 0 ? (cards[insertIndex - 1]?.position ?? '') : '';
      const right =
        insertIndex < cards.length
          ? (cards[insertIndex]?.position ?? HIGH_SENTINEL)
          : HIGH_SENTINEL;
      return between(left, right);
    }
  }

  if (typeof posValue === 'number' && !Number.isNaN(posValue)) {
    const insertIndex = Math.max(0, Math.min(cards.length, Math.floor(posValue / 65535)));
    const left = insertIndex > 0 ? (cards[insertIndex - 1]?.position ?? '') : '';
    const right =
      insertIndex < cards.length ? (cards[insertIndex]?.position ?? HIGH_SENTINEL) : HIGH_SENTINEL;
    return between(left, right);
  }

  return between(last?.position ?? '', HIGH_SENTINEL);
}

async function hydrateCards(cards: CardRow[]): Promise<Map<string, HydratedCard>> {
  const cardIds = new Set(cards.map((card) => card.id));
  const listIds = new Set(cards.map((card) => card.list_id));

  const lists = await db('lists');
  const listsById = new Map<string, ListRow>();
  for (const row of lists as ListRow[]) {
    if (listIds.has(row.id)) listsById.set(row.id, row);
  }

  const boardIds = new Set(Array.from(listsById.values()).map((list) => list.board_id));
  const boards = await db('boards');
  const boardsById = new Map<string, BoardRow>();
  for (const row of boards as BoardRow[]) {
    if (boardIds.has(row.id)) boardsById.set(row.id, row);
  }

  const labels = (await db('labels')) as LabelRow[];
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const cardLabels = (await db('card_labels')) as Array<{ card_id: string; label_id: string }>;
  const labelsByCardId = new Map<string, LabelRow[]>();
  for (const row of cardLabels) {
    if (!cardIds.has(row.card_id)) continue;
    const label = labelsById.get(row.label_id);
    if (!label) continue;
    const current = labelsByCardId.get(row.card_id) ?? [];
    current.push(label);
    labelsByCardId.set(row.card_id, current);
  }

  const cardMembers = (await db('card_members')) as Array<{ card_id: string; user_id: string }>;
  const membersByCardId = new Map<string, Array<{ user_id: string }>>();
  for (const row of cardMembers) {
    if (!cardIds.has(row.card_id)) continue;
    const current = membersByCardId.get(row.card_id) ?? [];
    current.push({ user_id: row.user_id });
    membersByCardId.set(row.card_id, current);
  }

  const checklists = (await db('checklists')) as Array<{ id: string; card_id: string }>;
  const checklistsByCardId = new Map<string, Array<{ id: string }>>();
  for (const row of checklists) {
    if (!cardIds.has(row.card_id)) continue;
    const current = checklistsByCardId.get(row.card_id) ?? [];
    current.push({ id: row.id });
    checklistsByCardId.set(row.card_id, current);
  }

  const checklistItems = (await db('checklist_items')) as Array<{
    card_id: string;
    checked: boolean;
  }>;
  const checkItemCountByCardId = new Map<string, number>();
  const checkedCountByCardId = new Map<string, number>();
  for (const row of checklistItems) {
    if (!cardIds.has(row.card_id)) continue;
    checkItemCountByCardId.set(row.card_id, (checkItemCountByCardId.get(row.card_id) ?? 0) + 1);
    if (row.checked)
      checkedCountByCardId.set(row.card_id, (checkedCountByCardId.get(row.card_id) ?? 0) + 1);
  }

  const comments = (await db('comments')) as Array<{ card_id: string; deleted?: boolean }>;
  const commentCountByCardId = new Map<string, number>();
  for (const row of comments) {
    if (!cardIds.has(row.card_id) || row.deleted) continue;
    commentCountByCardId.set(row.card_id, (commentCountByCardId.get(row.card_id) ?? 0) + 1);
  }

  const attachments = (await db('attachments')) as Array<{ card_id: string }>;
  const attachmentCountByCardId = new Map<string, number>();
  for (const row of attachments) {
    if (!cardIds.has(row.card_id)) continue;
    attachmentCountByCardId.set(row.card_id, (attachmentCountByCardId.get(row.card_id) ?? 0) + 1);
  }

  const customFields = (await db('custom_fields')) as CustomFieldRow[];
  const customFieldById = new Map(customFields.map((row) => [row.id, row]));
  const customFieldValues = (await db('card_custom_field_values')) as Array<{
    id: string;
    card_id: string;
    custom_field_id: string;
    value_text?: string | null;
    value_number?: number | string | null;
    value_date?: string | Date | null;
    value_checkbox?: boolean | null;
    value_option_id?: string | null;
  }>;
  const customFieldItemsByCardId = new Map<string, HydratedCard['customFieldItems']>();
  for (const row of customFieldValues) {
    if (!cardIds.has(row.card_id)) continue;
    const field = customFieldById.get(row.custom_field_id);
    const current = customFieldItemsByCardId.get(row.card_id) ?? [];
    current.push({
      ...row,
      field_type: field?.field_type,
    });
    customFieldItemsByCardId.set(row.card_id, current);
  }

  const hydrated = new Map<string, HydratedCard>();
  for (const card of cards) {
    const list = listsById.get(card.list_id);
    if (!list) continue;
    const board = boardsById.get(list.board_id);
    if (!board) continue;
    hydrated.set(card.id, {
      card,
      list,
      board,
      labels: labelsByCardId.get(card.id) ?? [],
      members: membersByCardId.get(card.id) ?? [],
      checklists: checklistsByCardId.get(card.id) ?? [],
      attachmentCount: attachmentCountByCardId.get(card.id) ?? 0,
      commentCount: commentCountByCardId.get(card.id) ?? 0,
      checkItemCount: checkItemCountByCardId.get(card.id) ?? 0,
      checkItemsChecked: checkedCountByCardId.get(card.id) ?? 0,
      customFieldItems: customFieldItemsByCardId.get(card.id) ?? [],
    });
  }

  return hydrated;
}

function serializeHydratedCard(hydrated: HydratedCard, rank: number): TrelloCard {
  return serializeCard({
    ...hydrated.card,
    board_id: hydrated.board.id,
    labels: hydrated.labels.map((label) => serializeLabel(label)),
    members: hydrated.members,
    checklists: hydrated.checklists,
    attachmentCount: hydrated.attachmentCount,
    commentCount: hydrated.commentCount,
    checkItemCount: hydrated.checkItemCount,
    checkItemsChecked: hydrated.checkItemsChecked,
    customFieldItems: hydrated.customFieldItems.map((item) =>
      serializeCustomFieldItem(item, item.field_type)
    ),
    _rank: rank,
  });
}

export async function listTrelloCardsForBoard(
  boardId: string,
  filter: 'open' | 'closed' | 'all'
): Promise<TrelloCard[]> {
  const lists = (await db('lists')
    .where({ board_id: boardId })
    .orderBy('position', 'asc')) as ListRow[];
  const listIds = new Set(lists.map((row) => row.id));
  if (listIds.size === 0) return [];

  const allCards = (await db('cards').orderBy('position', 'asc')) as CardRow[];
  const cards = allCards.filter((card) => {
    if (!listIds.has(card.list_id)) return false;
    if (filter === 'all') return true;
    if (filter === 'closed') return card.archived;
    return !card.archived;
  });

  const hydrated = await hydrateCards(cards);
  return cards
    .map((card, index) => {
      const item = hydrated.get(card.id);
      return item ? serializeHydratedCard(item, index) : null;
    })
    .filter((item): item is TrelloCard => item !== null);
}

export async function listTrelloCardsForList(
  listId: string,
  filter: 'open' | 'closed' | 'all'
): Promise<TrelloCard[]> {
  const cards = (await db('cards')
    .where({ list_id: listId })
    .orderBy('position', 'asc')) as CardRow[];

  const filtered = cards.filter((card) => {
    if (filter === 'all') return true;
    if (filter === 'closed') return card.archived;
    return !card.archived;
  });

  const hydrated = await hydrateCards(filtered);
  return filtered
    .map((card, index) => {
      const item = hydrated.get(card.id);
      return item ? serializeHydratedCard(item, index) : null;
    })
    .filter((item): item is TrelloCard => item !== null);
}

export async function loadTrelloCardById(cardId: string): Promise<TrelloCard | null> {
  const card = (await db('cards').where({ id: cardId }).first()) as CardRow | undefined;
  if (!card) return null;
  const hydrated = await hydrateCards([card]);
  const item = hydrated.get(card.id);
  if (!item) return null;
  return serializeHydratedCard(item, 0);
}

async function listBoardMemberships(boardId: string): Promise<
  Array<{
    id: string;
    idMember: string;
    memberType: 'admin' | 'normal' | 'observer';
    unconfirmed: false;
    deactivated: false;
  }>
> {
  const boardMembers = (await db('board_members')
    .where({ board_id: boardId })
    .orderBy('created_at', 'asc')) as Array<{ id: string; user_id: string; role: string }>;
  const guestRows = (await db('board_guest_access')
    .where({ board_id: boardId })
    .orderBy('granted_at', 'asc')) as Array<{ id: string; user_id: string }>;

  const memberships: Array<{
    id: string;
    idMember: string;
    memberType: 'admin' | 'normal' | 'observer';
    unconfirmed: false;
    deactivated: false;
  }> = boardMembers.map((row) => ({
    id: row.id,
    idMember: row.user_id,
    memberType: row.role === 'ADMIN' ? 'admin' : 'normal',
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

async function loadUsersByIds(ids: string[]): Promise<Map<string, UserRow>> {
  if (ids.length === 0) return new Map();
  const idSet = new Set(ids);
  const users = (await db('users')) as UserRow[];
  return new Map(users.filter((user) => idSet.has(user.id)).map((user) => [user.id, user]));
}

function mapActivityType(action: string): string {
  if (action === 'card_created') return 'createCard';
  if (action === 'card_updated' || action === 'card_moved' || action === 'card_move_blocked')
    return 'updateCard';
  if (action === 'card_member_assigned') return 'addMemberToCard';
  if (action === 'card_member_unassigned') return 'removeMemberFromCard';
  return action;
}

async function listCardActions(
  card: TrelloCard,
  board: BoardRow,
  list: ListRow
): Promise<Response> {
  const comments = (await db('comments')
    .where({ card_id: card.id })
    .orderBy('created_at', 'asc')) as Array<{
    id: string;
    user_id: string;
    content: string;
    created_at?: string | Date | null;
    deleted?: boolean;
  }>;
  const activities = (await db('activities')
    .where({ entity_id: card.id })
    .orderBy('created_at', 'asc')) as Array<{
    id: string;
    actor_id: string;
    action: string;
    payload?: Record<string, unknown>;
    created_at?: string | Date | null;
  }>;

  const actorIds = [
    ...new Set([
      ...comments.filter((row) => !row.deleted).map((row) => row.user_id),
      ...activities.map((row) => row.actor_id),
    ]),
  ];
  const users = await loadUsersByIds(actorIds);

  const result = [];
  for (const comment of comments) {
    if (comment.deleted) continue;
    const user = users.get(comment.user_id);
    if (!user) continue;
    result.push(
      serializeAction({
        id: comment.id,
        type: 'commentCard',
        date: comment.created_at ?? null,
        memberCreator: {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          avatar_url: user.avatar_url ?? null,
        },
        data: {
          text: comment.content,
          card: { id: card.id, name: card.name, idShort: card.idShort, shortLink: card.shortLink },
          board: { id: board.id, name: board.title, shortLink: board.id.slice(0, 8) },
          list: { id: list.id, name: list.title },
        },
      })
    );
  }

  for (const activity of activities) {
    const user = users.get(activity.actor_id);
    if (!user) continue;
    result.push(
      serializeAction({
        id: activity.id,
        type: mapActivityType(activity.action),
        date: activity.created_at ?? null,
        memberCreator: {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          avatar_url: user.avatar_url ?? null,
        },
        data: {
          card: { id: card.id, name: card.name, idShort: card.idShort, shortLink: card.shortLink },
          board: { id: board.id, name: board.title, shortLink: board.id.slice(0, 8) },
          list: { id: list.id, name: list.title },
          ...(activity.payload ?? {}),
        },
      })
    );
  }

  return Response.json(result);
}

function serializeAttachmentRow(attachment: {
  id: string;
  card_id: string;
  uploaded_by: string;
  name: string;
  type: string;
  size_bytes?: number | null;
  mime_type?: string | null;
  url?: string | null;
  created_at?: string | Date | null;
}) {
  return {
    id: attachment.id,
    bytes: attachment.size_bytes ?? 0,
    date: attachment.created_at
      ? new Date(attachment.created_at).toISOString()
      : new Date().toISOString(),
    edgeColor: null,
    idMember: attachment.uploaded_by,
    isUpload: attachment.type === 'FILE',
    mimeType: attachment.mime_type ?? null,
    name: attachment.name,
    previews: [],
    url: attachment.url ?? null,
    idCard: attachment.card_id,
  };
}

export async function cardsRouter(
  req: AuthenticatedRequest,
  path: string
): Promise<Response | null> {
  const user = getTrelloAuthUser(req);
  if (!user) return trelloError('invalid token', 401);

  const pathname = path.replace(/\/+$/, '') || '/';
  const url = new URL(req.url);

  if (req.method === 'POST' && (pathname === '/cards' || path === '/cards/')) {
    const body = await parseBody(req);
    const name = getInput(url, body, 'name');
    const idListInput = getInput(url, body, 'idList');
    const desc = getInput(url, body, 'desc');
    const due = getInput(url, body, 'due');
    const start = getInput(url, body, 'start');
    const pos = getInput(url, body, 'pos');
    const idMembers = toStringArray(getInput(url, body, 'idMembers'));
    const idLabels = toStringArray(getInput(url, body, 'idLabels'));

    if (typeof name !== 'string' || name.trim() === '')
      return trelloError('invalid value for name', 400);
    if (typeof idListInput !== 'string' || idListInput.trim() === '')
      return trelloError('invalid value for idList', 400);

    const listId = await resolveListId(idListInput);
    if (!listId) return TRELLO_LIST_NOT_FOUND();

    const list = (await db('lists').where({ id: listId }).first()) as ListRow | undefined;
    if (!list) return TRELLO_LIST_NOT_FOUND();
    const board = (await db('boards').where({ id: list.board_id }).first()) as BoardRow | undefined;
    if (!board) return TRELLO_NOT_FOUND();
    if (!(await canMutateBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();

    const cardId = randomUUID();
    const shortId = await generateUniqueShortId('cards');
    const position = await resolvePositionForList(list.id, pos);

    await db('cards').insert({
      id: cardId,
      short_id: shortId,
      list_id: list.id,
      title: name.trim(),
      description: typeof desc === 'string' ? desc : null,
      archived: false,
      due_date: typeof due === 'string' && due.trim() ? due : null,
      due_complete: false,
      start_date: typeof start === 'string' && start.trim() ? start : null,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    for (const memberId of idMembers) {
      const exists = await db('users').where({ id: memberId }).first();
      if (!exists) continue;
      const existing = await db('card_members')
        .where({ card_id: cardId, user_id: memberId })
        .first();
      if (!existing) await db('card_members').insert({ card_id: cardId, user_id: memberId });
    }

    for (const labelId of idLabels) {
      const label = await db('labels').where({ id: labelId, board_id: board.id }).first();
      if (!label) continue;
      const existing = await db('card_labels')
        .where({ card_id: cardId, label_id: labelId })
        .first();
      if (!existing) await db('card_labels').insert({ card_id: cardId, label_id: labelId });
    }

    const created = await loadTrelloCardById(cardId);
    if (!created) return TRELLO_CARD_NOT_FOUND();
    return Response.json(created);
  }

  const cardMatch = pathname.match(/^\/cards\/([^/]+)(?:\/(.*))?$/);
  if (!cardMatch) return null;

  const cardIdentifier = cardMatch[1] as string;
  const subPath = cardMatch[2] ?? '';
  const context = await resolveCardContext(cardIdentifier);
  if (!context) return TRELLO_CARD_NOT_FOUND();

  if (!(await canReadBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
  const card = await loadTrelloCardById(context.card.id);
  if (!card) return TRELLO_CARD_NOT_FOUND();

  if (subPath === '' && req.method === 'GET') return Response.json(card);

  if (subPath === '' && req.method === 'PUT') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);

    const name = getInput(url, body, 'name');
    const desc = getInput(url, body, 'desc');
    const closed = getInput(url, body, 'closed');
    const due = getInput(url, body, 'due');
    const dueComplete = getInput(url, body, 'dueComplete');
    const start = getInput(url, body, 'start');
    const idListInput = getInput(url, body, 'idList');
    const idBoardInput = getInput(url, body, 'idBoard');
    const pos = getInput(url, body, 'pos');

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let targetListId = context.list.id;
    let targetBoardId = context.board.id;

    if (typeof name === 'string') {
      if (!name.trim()) return trelloError('invalid value for name', 400);
      updates['title'] = name.trim();
    }
    if (typeof desc === 'string') updates['description'] = desc;
    if (closed !== undefined) updates['archived'] = toBoolean(closed);

    if (due !== undefined) {
      if (due === null || due === '') updates['due_date'] = null;
      else if (typeof due === 'string') updates['due_date'] = due;
    }

    if (dueComplete !== undefined) updates['due_complete'] = toBoolean(dueComplete);

    if (start !== undefined) {
      if (start === null || start === '') updates['start_date'] = null;
      else if (typeof start === 'string') updates['start_date'] = start;
    }

    if (typeof idBoardInput === 'string' && idBoardInput.trim()) {
      const boardId = await resolveBoardId(idBoardInput);
      if (!boardId) return TRELLO_NOT_FOUND();
      const board = (await db('boards').where({ id: boardId }).first()) as BoardRow | undefined;
      if (!board) return TRELLO_NOT_FOUND();
      if (!(await canMutateBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();
      targetBoardId = board.id;

      const boardLists = (await db('lists')
        .where({ board_id: board.id, archived: false })
        .orderBy('position', 'asc')) as ListRow[];
      const firstList = boardLists[0];
      if (!firstList) return trelloError('invalid value for idBoard', 400);
      targetListId = firstList.id;
    }

    if (typeof idListInput === 'string' && idListInput.trim()) {
      const listId = await resolveListId(idListInput);
      if (!listId) return TRELLO_LIST_NOT_FOUND();
      const list = (await db('lists').where({ id: listId }).first()) as ListRow | undefined;
      if (!list) return TRELLO_LIST_NOT_FOUND();
      const board = (await db('boards').where({ id: list.board_id }).first()) as
        | BoardRow
        | undefined;
      if (!board) return TRELLO_NOT_FOUND();
      if (!(await canMutateBoard(user.id, board))) return TRELLO_PERMISSION_DENIED();
      targetListId = list.id;
      targetBoardId = list.board_id;
    }

    if (targetListId !== context.card.list_id) {
      try {
        await validateCardMove({
          boardId: context.board.id,
          fromListId: context.card.list_id,
          toListId: targetListId,
          cardId: context.card.id,
          actorId: user.id,
          ipAddress:
            req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        });
      } catch (error) {
        if (error instanceof StateTransitionForbiddenError) {
          return toTrelloStateTransitionForbiddenResponse(error);
        }
        throw error;
      }
    }

    if (targetListId !== context.card.list_id) updates['list_id'] = targetListId;
    if (pos !== undefined || targetListId !== context.card.list_id) {
      updates['position'] = await resolvePositionForList(targetListId, pos);
    }

    await db('cards').where({ id: context.card.id }).update(updates);
    const updated = await loadTrelloCardById(context.card.id);
    if (!updated) return TRELLO_CARD_NOT_FOUND();
    if (updated.idBoard !== targetBoardId) {
      const list = (await db('lists').where({ id: updated.idList }).first()) as ListRow | undefined;
      if (list) {
        const hydrated = await loadTrelloCardById(updated.id);
        if (hydrated) return Response.json(hydrated);
      }
    }
    return Response.json(updated);
  }

  if (subPath === '' && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('cards').where({ id: context.card.id }).delete();
    return Response.json({});
  }

  if (subPath === 'board' && req.method === 'GET') {
    const memberships = await listBoardMemberships(context.board.id);
    return Response.json(
      serializeBoard({
        ...context.board,
        idMemberCreator: memberships[0]?.idMember ?? '',
        memberships,
      })
    );
  }

  if (subPath === 'list' && req.method === 'GET') {
    const boardLists = (await db('lists')
      .where({ board_id: context.board.id })
      .orderBy('position', 'asc')) as ListRow[];
    const rank = Math.max(
      0,
      boardLists.findIndex((row) => row.id === context.list.id)
    );
    return Response.json(serializeList({ ...context.list, _rank: rank }));
  }

  if (subPath === 'actions' && req.method === 'GET') {
    return listCardActions(card, context.board, context.list);
  }

  if (subPath === 'actions/comments' && req.method === 'POST') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const textInput = getInput(url, body, 'text');
    if (typeof textInput !== 'string' || !textInput.trim())
      return trelloError('invalid value for text', 400);

    const commentId = randomUUID();
    const shortId = await generateUniqueShortId('comments');
    await db('comments').insert({
      id: commentId,
      short_id: shortId,
      card_id: context.card.id,
      user_id: user.id,
      content: textInput.trim(),
      version: 1,
      deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return Response.json(
      serializeAction({
        id: commentId,
        type: 'commentCard',
        date: new Date().toISOString(),
        memberCreator: {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          avatar_url: user.avatar_url ?? null,
        },
        data: {
          text: textInput.trim(),
          card: { id: card.id, name: card.name, idShort: card.idShort, shortLink: card.shortLink },
          board: {
            id: context.board.id,
            name: context.board.title,
            shortLink: context.board.id.slice(0, 8),
          },
          list: { id: context.list.id, name: context.list.title },
        },
      })
    );
  }

  const actionCommentMatch = subPath.match(/^actions\/([^/]+)\/comments$/);
  if (actionCommentMatch && req.method === 'PUT') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const actionId = actionCommentMatch[1] as string;
    const commentId = (await resolveCardId(actionId)) ? actionId : actionId;
    const existing = (await db('comments')
      .where({ id: commentId, card_id: context.card.id })
      .first()) as { id: string; user_id: string; version: number } | undefined;
    if (!existing) return TRELLO_COMMENT_NOT_FOUND();
    if (existing.user_id !== user.id) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const textInput = getInput(url, body, 'text');
    if (typeof textInput !== 'string' || !textInput.trim())
      return trelloError('invalid value for text', 400);
    await db('comments')
      .where({ id: existing.id })
      .update({
        content: textInput.trim(),
        version: existing.version + 1,
        updated_at: new Date().toISOString(),
      });
    return Response.json(
      serializeAction({
        id: existing.id,
        type: 'commentCard',
        date: new Date().toISOString(),
        memberCreator: {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          avatar_url: user.avatar_url ?? null,
        },
        data: {
          text: textInput.trim(),
          card: { id: card.id, name: card.name, idShort: card.idShort, shortLink: card.shortLink },
          board: {
            id: context.board.id,
            name: context.board.title,
            shortLink: context.board.id.slice(0, 8),
          },
          list: { id: context.list.id, name: context.list.title },
        },
      })
    );
  }

  if (actionCommentMatch && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const actionId = actionCommentMatch[1] as string;
    const existing = (await db('comments')
      .where({ id: actionId, card_id: context.card.id })
      .first()) as { id: string; user_id: string } | undefined;
    if (!existing) return TRELLO_COMMENT_NOT_FOUND();
    if (existing.user_id !== user.id) return TRELLO_PERMISSION_DENIED();
    await db('comments').where({ id: existing.id }).delete();
    return Response.json({});
  }

  if (subPath === 'members' && req.method === 'GET') {
    const cardMembers = (await db('card_members').where({ card_id: context.card.id })) as Array<{
      user_id: string;
    }>;
    const users = await loadUsersByIds(cardMembers.map((row) => row.user_id));
    const response = [];
    for (const row of cardMembers) {
      const member = users.get(row.user_id);
      if (!member) continue;
      response.push(
        serializeMember({
          id: member.id,
          email: member.email,
          name: member.name ?? member.email,
          avatar_url: member.avatar_url ?? null,
        })
      );
    }
    return Response.json(response);
  }

  if (subPath === 'idMembers' && req.method === 'POST') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const value = getInput(url, body, 'value');
    if (typeof value !== 'string' || !value.trim())
      return trelloError('invalid value for value', 400);
    const member = await db('users').where({ id: value }).first();
    if (!member) return TRELLO_NOT_FOUND();
    const existing = await db('card_members')
      .where({ card_id: context.card.id, user_id: value })
      .first();
    if (!existing) await db('card_members').insert({ card_id: context.card.id, user_id: value });
    const updated = await loadTrelloCardById(context.card.id);
    if (!updated) return TRELLO_CARD_NOT_FOUND();
    return Response.json(updated);
  }

  const memberDeleteMatch = subPath.match(/^idMembers\/([^/]+)$/);
  if (memberDeleteMatch && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('card_members')
      .where({ card_id: context.card.id, user_id: memberDeleteMatch[1] })
      .delete();
    const updated = await loadTrelloCardById(context.card.id);
    if (!updated) return TRELLO_CARD_NOT_FOUND();
    return Response.json(updated);
  }

  if (subPath === 'idLabels' && req.method === 'POST') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const value = getInput(url, body, 'value');
    if (typeof value !== 'string' || !value.trim())
      return trelloError('invalid value for value', 400);
    const label = await db('labels').where({ id: value, board_id: context.board.id }).first();
    if (!label) return TRELLO_NOT_FOUND();
    const existing = await db('card_labels')
      .where({ card_id: context.card.id, label_id: value })
      .first();
    if (!existing) await db('card_labels').insert({ card_id: context.card.id, label_id: value });
    const updated = await loadTrelloCardById(context.card.id);
    if (!updated) return TRELLO_CARD_NOT_FOUND();
    return Response.json(updated);
  }

  const labelDeleteMatch = subPath.match(/^idLabels\/([^/]+)$/);
  if (labelDeleteMatch && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('card_labels')
      .where({ card_id: context.card.id, label_id: labelDeleteMatch[1] })
      .delete();
    const updated = await loadTrelloCardById(context.card.id);
    if (!updated) return TRELLO_CARD_NOT_FOUND();
    return Response.json(updated);
  }

  if (subPath === 'checklists' && req.method === 'GET') {
    const checklists = (await db('checklists')
      .where({ card_id: context.card.id })
      .orderBy('position', 'asc')) as Array<{ id: string; card_id: string; title: string }>;
    const allItems = (await db('checklist_items')
      .where({ card_id: context.card.id })
      .orderBy('position', 'asc')) as Array<{
      id: string;
      checklist_id: string;
      card_id: string;
      title: string;
      checked: boolean;
      due_date?: string | Date | null;
      assigned_member_id?: string | null;
    }>;

    const itemsByChecklistId = new Map<
      string,
      Array<{
        id: string;
        checklist_id: string;
        card_id: string;
        title: string;
        checked: boolean;
        due_date?: string | Date | null;
        assigned_member_id?: string | null;
      }>
    >();
    for (const item of allItems) {
      const current = itemsByChecklistId.get(item.checklist_id) ?? [];
      current.push(item);
      itemsByChecklistId.set(item.checklist_id, current);
    }

    return Response.json(
      checklists.map((checklist, checklistRank) =>
        serializeChecklist({
          id: checklist.id,
          board_id: context.board.id,
          card_id: context.card.id,
          title: checklist.title,
          _rank: checklistRank,
          checkItems: (itemsByChecklistId.get(checklist.id) ?? []).map((item, itemRank) =>
            serializeCheckItem({
              ...item,
              _rank: itemRank,
            })
          ),
        })
      )
    );
  }

  if (subPath === 'checklists' && req.method === 'POST') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const body = await parseBody(req);
    const name = getInput(url, body, 'name');

    const existing = (await db('checklists')
      .where({ card_id: context.card.id })
      .orderBy('position', 'asc')) as Array<{ id: string; position: string }>;
    const position = between(existing.at(-1)?.position ?? '', HIGH_SENTINEL);

    const checklistId = randomUUID();
    await db('checklists').insert({
      id: checklistId,
      card_id: context.card.id,
      title: typeof name === 'string' && name.trim() ? name.trim() : 'Checklist',
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const created = (await db('checklists').where({ id: checklistId }).first()) as
      | {
          id: string;
          card_id: string;
          title: string;
        }
      | undefined;
    if (!created) return TRELLO_NOT_FOUND();

    return Response.json(
      serializeChecklist({
        id: created.id,
        board_id: context.board.id,
        card_id: created.card_id,
        title: created.title,
        _rank: existing.length,
        checkItems: [],
      })
    );
  }

  const checklistDeleteMatch = subPath.match(/^checklists\/([^/]+)$/);
  if (checklistDeleteMatch && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('checklists')
      .where({ id: checklistDeleteMatch[1], card_id: context.card.id })
      .delete();
    return Response.json({});
  }

  if (subPath === 'checkItemStates' && req.method === 'GET') {
    const items = (await db('checklist_items')
      .where({ card_id: context.card.id })
      .orderBy('position', 'asc')) as Array<{ id: string; checked: boolean }>;
    return Response.json(
      items.map((item) => ({
        idCheckItem: item.id,
        state: item.checked ? 'complete' : 'incomplete',
      }))
    );
  }

  const checkItemMatch = subPath.match(/^checkItem\/([^/]+)$/);
  if (checkItemMatch && req.method === 'GET') {
    const item = (await db('checklist_items')
      .where({ id: checkItemMatch[1], card_id: context.card.id })
      .first()) as
      | {
          id: string;
          checklist_id: string;
          card_id: string;
          title: string;
          checked: boolean;
          due_date?: string | Date | null;
          assigned_member_id?: string | null;
        }
      | undefined;
    if (!item) return TRELLO_NOT_FOUND();

    const checklistItems = (await db('checklist_items')
      .where({ checklist_id: item.checklist_id })
      .orderBy('position', 'asc')) as Array<{ id: string }>;
    const rank = Math.max(
      0,
      checklistItems.findIndex((row) => row.id === item.id)
    );

    return Response.json(serializeCheckItem({ ...item, _rank: rank }));
  }

  if (checkItemMatch && req.method === 'PUT') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const existing = (await db('checklist_items')
      .where({ id: checkItemMatch[1], card_id: context.card.id })
      .first()) as
      | {
          id: string;
          checklist_id: string;
          card_id: string;
          title: string;
          checked: boolean;
          due_date?: string | Date | null;
          assigned_member_id?: string | null;
          position: string;
        }
      | undefined;
    if (!existing) return TRELLO_NOT_FOUND();

    const body = await parseBody(req);
    const updates: Record<string, unknown> = {};
    const name = getInput(url, body, 'name');
    const state = getInput(url, body, 'state');
    const pos = getInput(url, body, 'pos');
    const due = getInput(url, body, 'due');
    const idMember = getInput(url, body, 'idMember');

    if (typeof name === 'string' && name.trim()) updates['title'] = name.trim();
    if (state !== undefined) updates['checked'] = String(state).toLowerCase() === 'complete';
    if (due !== undefined) {
      if (due === null || due === '') updates['due_date'] = null;
      else if (typeof due === 'string') updates['due_date'] = due;
    }
    if (idMember !== undefined) {
      if (idMember === null || idMember === '') updates['assigned_member_id'] = null;
      else if (typeof idMember === 'string') updates['assigned_member_id'] = idMember;
    }
    if (pos !== undefined) {
      const siblings = (await db('checklist_items')
        .where({ checklist_id: existing.checklist_id })
        .orderBy('position', 'asc')) as Array<{ id: string; position: string }>;
      if (String(pos).toLowerCase() === 'top') {
        updates['position'] = between('', siblings[0]?.position ?? HIGH_SENTINEL);
      } else if (String(pos).toLowerCase() === 'bottom') {
        updates['position'] = between(siblings.at(-1)?.position ?? '', HIGH_SENTINEL);
      }
    }

    if (Object.keys(updates).length > 0) {
      await db('checklist_items').where({ id: existing.id }).update(updates);
    }
    const updated = (await db('checklist_items').where({ id: existing.id }).first()) as
      | {
          id: string;
          checklist_id: string;
          card_id: string;
          title: string;
          checked: boolean;
          due_date?: string | Date | null;
          assigned_member_id?: string | null;
        }
      | undefined;
    if (!updated) return TRELLO_NOT_FOUND();

    const checklistItems = (await db('checklist_items')
      .where({ checklist_id: updated.checklist_id })
      .orderBy('position', 'asc')) as Array<{ id: string }>;
    const rank = Math.max(
      0,
      checklistItems.findIndex((row) => row.id === updated.id)
    );
    return Response.json(serializeCheckItem({ ...updated, _rank: rank }));
  }

  if (checkItemMatch && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('checklist_items').where({ id: checkItemMatch[1], card_id: context.card.id }).delete();
    return Response.json({});
  }

  const checklistItemStateMatch = subPath.match(/^checklist\/([^/]+)\/checkItem\/([^/]+)$/);
  if (checklistItemStateMatch && req.method === 'PUT') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const checklistId = checklistItemStateMatch[1] as string;
    const itemId = checklistItemStateMatch[2] as string;
    const item = (await db('checklist_items')
      .where({ id: itemId, checklist_id: checklistId, card_id: context.card.id })
      .first()) as
      | {
          id: string;
        }
      | undefined;
    if (!item) return TRELLO_NOT_FOUND();
    const body = await parseBody(req);
    const state = getInput(url, body, 'state');
    if (state === undefined) return trelloError('invalid value for state', 400);
    await db('checklist_items')
      .where({ id: item.id })
      .update({
        checked: String(state).toLowerCase() === 'complete',
      });
    const updated = (await db('checklist_items').where({ id: item.id }).first()) as
      | {
          id: string;
          checklist_id: string;
          card_id: string;
          title: string;
          checked: boolean;
          due_date?: string | Date | null;
          assigned_member_id?: string | null;
        }
      | undefined;
    if (!updated) return TRELLO_NOT_FOUND();
    const checklistItems = (await db('checklist_items')
      .where({ checklist_id: updated.checklist_id })
      .orderBy('position', 'asc')) as Array<{ id: string }>;
    const rank = Math.max(
      0,
      checklistItems.findIndex((row) => row.id === updated.id)
    );
    return Response.json(serializeCheckItem({ ...updated, _rank: rank }));
  }

  const customFieldItemMatch = subPath.match(/^customField\/([^/]+)\/item$/);
  if (customFieldItemMatch && req.method === 'PUT') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    const field = (await db('custom_fields').where({ id: customFieldItemMatch[1] }).first()) as
      | CustomFieldRow
      | undefined;
    if (!field || field.board_id !== context.board.id) return TRELLO_CUSTOM_FIELD_NOT_FOUND();

    const body = await parseBody(req);
    const value = getInput(url, body, 'value');
    const patch = buildCustomFieldValuePatch(field.field_type, value, field.options);
    if (!patch) return trelloError('invalid value for value', 400);

    const existing = (await db('card_custom_field_values')
      .where({ card_id: context.card.id, custom_field_id: field.id })
      .first()) as { id: string } | undefined;

    if (existing) {
      await db('card_custom_field_values').where({ id: existing.id }).update(patch);
    } else {
      await db('card_custom_field_values').insert({
        id: randomUUID(),
        card_id: context.card.id,
        custom_field_id: field.id,
        ...patch,
      });
    }

    const updated = (await db('card_custom_field_values')
      .where({ card_id: context.card.id, custom_field_id: field.id })
      .first()) as
      | {
          id: string;
          card_id: string;
          custom_field_id: string;
          value_text?: string | null;
          value_number?: number | string | null;
          value_date?: string | Date | null;
          value_checkbox?: boolean | null;
          value_option_id?: string | null;
        }
      | undefined;
    if (!updated) return TRELLO_CUSTOM_FIELD_NOT_FOUND();
    return Response.json(serializeCustomFieldItem(updated, field.field_type));
  }

  if (subPath === 'customFieldItems' && req.method === 'GET') {
    const customFields = (await db('custom_fields')) as CustomFieldRow[];
    const customFieldTypeById = new Map(customFields.map((row) => [row.id, row.field_type]));
    const values = (await db('card_custom_field_values').where({
      card_id: context.card.id,
    })) as Array<{
      id: string;
      card_id: string;
      custom_field_id: string;
      value_text?: string | null;
      value_number?: number | string | null;
      value_date?: string | Date | null;
      value_checkbox?: boolean | null;
      value_option_id?: string | null;
    }>;
    return Response.json(
      values.map((row) =>
        serializeCustomFieldItem(row, customFieldTypeById.get(row.custom_field_id))
      )
    );
  }

  if (subPath === 'pluginData' && req.method === 'GET') {
    const rows = (await db('plugin_data').where({
      scope: 'card',
      resource_id: context.card.id,
      board_id: context.board.id,
    })) as PluginDataRow[];

    const visibleRows = rows.filter((row) => {
      const visibility = resolvePluginDataVisibility(row);
      return visibility === 'shared' || visibility === 'public';
    });

    return Response.json(
      visibleRows.map((row) => {
        const value = toPluginDataValueString(row.value);
        return value === undefined
          ? { idPlugin: row.plugin_id ?? undefined }
          : { idPlugin: row.plugin_id ?? undefined, value };
      })
    );
  }

  if (subPath === 'attachments' && req.method === 'GET') {
    const attachments = await db('attachments')
      .where({ card_id: context.card.id })
      .orderBy('created_at', 'asc');
    return Response.json(
      (
        attachments as Array<{
          id: string;
          card_id: string;
          uploaded_by: string;
          name: string;
          type: string;
          size_bytes?: number | null;
          mime_type?: string | null;
          url?: string | null;
          created_at?: string | Date | null;
        }>
      ).map((row) => serializeAttachmentRow(row))
    );
  }

  const attachmentMatch = subPath.match(/^attachments\/([^/]+)$/);
  if (attachmentMatch && req.method === 'GET') {
    const attachment = (await db('attachments')
      .where({ id: attachmentMatch[1], card_id: context.card.id })
      .first()) as
      | {
          id: string;
          card_id: string;
          uploaded_by: string;
          name: string;
          type: string;
          size_bytes?: number | null;
          mime_type?: string | null;
          url?: string | null;
          created_at?: string | Date | null;
        }
      | undefined;
    if (!attachment) return TRELLO_NOT_FOUND();
    return Response.json(serializeAttachmentRow(attachment));
  }

  if (attachmentMatch && req.method === 'DELETE') {
    if (!(await canMutateBoard(user.id, context.board))) return TRELLO_PERMISSION_DENIED();
    await db('attachments').where({ id: attachmentMatch[1], card_id: context.card.id }).delete();
    return Response.json({});
  }

  const fieldMatch = subPath.match(/^([a-zA-Z0-9_]+)$/);
  if (fieldMatch && req.method === 'GET') {
    const field = fieldMatch[1] as keyof TrelloCard;
    if (field in card) return Response.json(card[field]);
    return TRELLO_NOT_FOUND();
  }

  return null;
}
