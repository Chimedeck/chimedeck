import type { TrelloAction, TrelloActionType, TrelloMember } from '../types/trello';
import { serializeEmbeddedLabel } from './label';
import { serializeMember } from './member';

function toIso(value: string | Date | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

export const EVENT_TYPE_MAP: Record<string, TrelloActionType> = {
  card_created: 'createCard',
  card_updated: 'updateCard',
  card_moved: 'updateCard',
  card_move_blocked: 'updateCard',
  card_member_assigned: 'addMemberToCard',
  card_member_unassigned: 'removeMemberFromCard',
  list_created: 'createList',
  card_label_added: 'addLabelToCard',
  card_label_removed: 'removeLabelFromCard',
};

type BasicMember = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
};

function normalizeMember(member: TrelloMember | BasicMember): TrelloMember {
  if ('fullName' in member) return member;
  return serializeMember(member);
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeDataLabels(
  data: Record<string, unknown>,
  fallbackBoardId = ''
): Record<string, unknown> {
  const normalized = { ...data };

  const label = normalized['label'];
  if (
    label &&
    typeof label === 'object' &&
    !Array.isArray(label) &&
    typeof (label as { id?: unknown }).id === 'string'
  ) {
    const source = label as {
      id: string;
      board_id?: string | null;
      idBoard?: string | null;
      name?: string | null;
      color?: string | null;
    };
    normalized['label'] = serializeEmbeddedLabel(source, fallbackBoardId);
  }

  const labels = normalized['labels'];
  if (Array.isArray(labels)) {
    normalized['labels'] = labels
      .filter(
        (entry): entry is Record<string, unknown> =>
          !!entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          typeof (entry as { id?: unknown }).id === 'string'
      )
      .map((entry) =>
        serializeEmbeddedLabel(
          entry as {
            id: string;
            board_id?: string | null;
            idBoard?: string | null;
            name?: string | null;
            color?: string | null;
          },
          fallbackBoardId
        )
      );
  }

  return normalized;
}

export function serializeCommentAction(comment: {
  id: string;
  card_id: string;
  board_id: string;
  list_id?: string | null;
  user_id: string;
  content: string;
  created_at: Date | string | null | undefined;
  memberCreator: TrelloMember | BasicMember;
  cardName?: string;
  boardName?: string;
  listName?: string;
}): TrelloAction {
  return {
    id: comment.id,
    idMemberCreator: comment.user_id,
    data: {
      text: comment.content,
      card: {
        id: comment.card_id,
        ...(comment.cardName ? { name: comment.cardName } : {}),
      },
      board: {
        id: comment.board_id,
        ...(comment.boardName ? { name: comment.boardName } : {}),
      },
      ...(comment.list_id
        ? {
            list: {
              id: comment.list_id,
              ...(comment.listName ? { name: comment.listName } : {}),
            },
          }
        : {}),
    },
    appCreator: null,
    type: 'commentCard',
    date: toIso(comment.created_at),
    limits: {},
    memberCreator: normalizeMember(comment.memberCreator),
  };
}

export function serializeActivityAction(event: {
  id: string;
  type: string;
  card_id?: string | null;
  board_id?: string | null;
  user_id: string;
  payload?: Record<string, unknown> | null;
  created_at: Date | string | null | undefined;
  memberCreator: TrelloMember | BasicMember;
}): TrelloAction {
  const trelloType = EVENT_TYPE_MAP[event.type] ?? 'updateCard';
  const payload = normalizeDataLabels(toRecord(event.payload), event.board_id ?? '');
  return {
    id: event.id,
    idMemberCreator: event.user_id,
    data: {
      ...payload,
      ...(event.card_id ? { card: { id: event.card_id } } : {}),
      ...(event.board_id ? { board: { id: event.board_id } } : {}),
    },
    appCreator: null,
    type: trelloType,
    date: toIso(event.created_at),
    limits: {},
    memberCreator: normalizeMember(event.memberCreator),
  };
}

export function serializeAction(action: {
  id: string;
  type: string;
  date?: string | Date | null;
  memberCreator: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string | null;
  };
  data?: Record<string, unknown>;
}): TrelloAction {
  const data = normalizeDataLabels(toRecord(action.data));
  if (action.type === 'commentCard') {
    const text = typeof data.text === 'string' ? data.text : '';
    const card = data.card as { id?: string; name?: string } | undefined;
    const board = data.board as { id?: string; name?: string } | undefined;
    const list = data.list as { id?: string; name?: string } | undefined;

    if (card?.id && board?.id) {
      return serializeCommentAction({
        id: action.id,
        user_id: action.memberCreator.id,
        content: text,
        card_id: card.id,
        board_id: board.id,
        list_id: list?.id ?? null,
        created_at: action.date,
        memberCreator: action.memberCreator,
        ...(card.name !== undefined ? { cardName: card.name } : {}),
        ...(board.name !== undefined ? { boardName: board.name } : {}),
        ...(list?.name !== undefined ? { listName: list.name } : {}),
      });
    }
  }

  return {
    id: action.id,
    idMemberCreator: action.memberCreator.id,
    data,
    appCreator: null,
    type: action.type,
    date: toIso(action.date),
    limits: {},
    memberCreator: serializeMember(action.memberCreator),
  };
}
