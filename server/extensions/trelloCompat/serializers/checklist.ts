import type { TrelloCheckItem, TrelloChecklist } from '../types/trello';
import { rankToPos } from './position';

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeCheckItem(item: {
  id: string;
  checklist_id: string;
  card_id: string;
  title: string;
  checked: boolean;
  _rank?: number;
  due_date?: string | Date | null;
  assigned_user_id?: string | null;
  assigned_member_id?: string | null;
}): TrelloCheckItem {
  return {
    id: item.id,
    idChecklist: item.checklist_id,
    idCard: item.card_id,
    name: item.title,
    pos: typeof item._rank === 'number' ? rankToPos(item._rank) : 65535,
    state: item.checked ? 'complete' : 'incomplete',
    due: toIso(item.due_date),
    dueReminder: null,
    idMember: item.assigned_member_id ?? item.assigned_user_id ?? null,
  };
}

export function serializeChecklist(checklist: {
  id: string;
  board_id: string;
  card_id: string;
  title: string;
  _rank?: number;
  checkItems: TrelloCheckItem[];
}): TrelloChecklist {
  return {
    id: checklist.id,
    idBoard: checklist.board_id,
    idCard: checklist.card_id,
    name: checklist.title,
    pos: typeof checklist._rank === 'number' ? rankToPos(checklist._rank) : 65535,
    checkItems: checklist.checkItems,
  };
}

export function toCardChecklistIds(rows: Array<{ id: string }>): string[] {
  return rows.map((row) => row.id);
}
