import type { TrelloCard, TrelloCustomFieldItem, TrelloLabel } from '../types/trello';
import { toCardChecklistIds } from './checklist';
import { serializeEmbeddedLabel, toCardLabelIds } from './label';
import { toCardMemberIds } from './member';
import { rankToPos } from './position';

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCoverSize(size: string | null | undefined): 'normal' | 'full' {
  return (size ?? '').toUpperCase() === 'FULL' ? 'full' : 'normal';
}

function normalizeCustomFieldItem(item: TrelloCustomFieldItem): TrelloCustomFieldItem {
  const value = item.value ?? {};
  if (Object.hasOwn(value, 'optionId')) {
    const optionId = value.optionId ?? null;
    return {
      ...item,
      idValue: optionId ?? item.idValue,
      value: { optionId },
    };
  }
  if (Object.hasOwn(value, 'date')) return { ...item, value: { date: value.date ?? null } };
  if (Object.hasOwn(value, 'number')) return { ...item, value: { number: value.number ?? null } };
  if (Object.hasOwn(value, 'checked'))
    return { ...item, value: { checked: value.checked ?? null } };
  return { ...item, value: { text: value.text ?? null } };
}

type CardLabelInput =
  | TrelloLabel
  | {
      id: string;
      board_id?: string | null;
      idBoard?: string | null;
      name?: string | null;
      color?: string | null;
    };

export function serializeCard(card: {
  id: string;
  list_id: string;
  board_id?: string;
  title: string;
  description?: string | null;
  archived: boolean;
  due_date?: Date | string | null;
  due_complete?: boolean | null;
  start_date?: Date | string | null;
  _rank?: number;
  updated_at?: Date | string | null;
  created_at?: Date | string | null;
  short_id?: string | number | null;
  cover_attachment_id?: string | null;
  cover_color?: string | null;
  cover_size?: string | null;
  labels?: CardLabelInput[];
  members?: Array<{ user_id: string }>;
  checklists?: Array<{ id: string }>;
  attachmentCount?: number;
  commentCount?: number;
  checkItemCount?: number;
  checkItemsChecked?: number;
  customFieldItems?: TrelloCustomFieldItem[];
}): TrelloCard {
  const due = toIso(card.due_date);
  const start = toIso(card.start_date);
  const pos = typeof card._rank === 'number' ? rankToPos(card._rank) : 65535;
  const shortLink =
    typeof card.short_id === 'number'
      ? card.short_id.toString()
      : (card.short_id ?? card.id.slice(0, 8));
  const idShort =
    typeof card.short_id === 'number'
      ? card.short_id
      : Number.parseInt(card.short_id ?? '', 10) || 0;
  const labels = (card.labels ?? []).map((label) =>
    serializeEmbeddedLabel(label, card.board_id ?? '')
  );
  const idChecklists = toCardChecklistIds(card.checklists ?? []);
  const idLabels = toCardLabelIds(labels);
  const idMembers = toCardMemberIds(card.members ?? []);
  const attachmentCount = card.attachmentCount ?? 0;

  return {
    id: card.id,
    address: null,
    badges: {
      attachmentsByType: { trello: { board: 0, card: 0 } },
      location: false,
      votes: 0,
      viewingMemberVoted: false,
      subscribed: false,
      dueComplete: card.due_complete ?? false,
      due,
      start,
      description: !!(card.description && card.description.length > 0),
      attachments: attachmentCount,
      comments: card.commentCount ?? 0,
      checkItems: card.checkItemCount ?? 0,
      checkItemsChecked: card.checkItemsChecked ?? 0,
      checkItemsEarliestDue: null,
      fogbugz: '',
    },
    checkItemStates: null,
    closed: card.archived,
    coordinates: null,
    cover: {
      idAttachment: card.cover_attachment_id ?? null,
      color: card.cover_color ?? null,
      idUploadedBackground: null,
      size: normalizeCoverSize(card.cover_size),
      brightness: 'dark',
      isTemplate: false,
    },
    creationMethod: null,
    dateLastActivity: toIso(card.updated_at) ?? toIso(card.created_at) ?? new Date().toISOString(),
    desc: card.description ?? '',
    descData: null,
    due,
    dueComplete: card.due_complete ?? false,
    dueReminder: null,
    idAttachmentCover: card.cover_attachment_id ?? null,
    idBoard: card.board_id ?? '',
    idChecklists,
    idLabels,
    idList: card.list_id,
    idMembers,
    idMembersVoted: [],
    idShort,
    labels,
    limits: {},
    locationName: null,
    manualCoverAttachment: false,
    name: card.title,
    nodeId: card.id,
    pos,
    shortLink,
    shortUrl: `/trello/1/c/${shortLink}`,
    start,
    subscribed: false,
    url: `/trello/1/cards/${card.id}`,
    customFieldItems: (card.customFieldItems ?? []).map((item) => normalizeCustomFieldItem(item)),
  };
}
