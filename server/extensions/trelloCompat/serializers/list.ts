import type { TrelloList } from '../types/trello';
import { rankToPos } from './position';

export function serializeList(list: {
  id: string;
  board_id: string;
  title: string;
  archived: boolean;
  color?: string | null;
  _rank?: number;
}): TrelloList {
  return {
    id: list.id,
    closed: list.archived,
    color: list.color ?? null,
    idBoard: list.board_id,
    name: list.title,
    nodeId: list.id,
    pos: typeof list._rank === 'number' ? rankToPos(list._rank) : 65535,
    softLimit: null,
    status: null,
    subscribed: false,
    limits: {},
  };
}
