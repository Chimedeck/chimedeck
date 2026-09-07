import type { TrelloLabel } from '../types/trello';

type LabelInput = {
  id: string;
  board_id?: string | null;
  idBoard?: string | null;
  name?: string | null;
  color?: string | null;
};

export function serializeEmbeddedLabel(label: LabelInput, fallbackBoardId = ''): TrelloLabel {
  return {
    id: label.id,
    idBoard: label.board_id ?? label.idBoard ?? fallbackBoardId,
    name: label.name ?? '',
    color: label.color ?? null,
  };
}

export function serializeLabel(label: {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
}): TrelloLabel {
  return serializeEmbeddedLabel(label);
}

export function toCardLabelIds(labels: Array<{ id?: string | null }>): string[] {
  return labels
    .map((label) => label.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}
