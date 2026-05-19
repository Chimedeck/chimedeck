import type { TrelloLabel } from '../types/trello';

export function serializeLabel(label: {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
}): TrelloLabel {
  return {
    id: label.id,
    idBoard: label.board_id,
    name: label.name,
    color: label.color,
  };
}

export function toCardLabelIds(labels: Array<{ id: string }>): string[] {
  return labels.map((label) => label.id);
}
