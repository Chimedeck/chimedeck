// Types for the TableView extension (Sprint 52 — Table View).
import type { Card } from '../Card/api';
import type { List } from '../List/api';

export type SortDirection = 'asc' | 'desc' | 'none';

export type ColumnKey =
  | 'title'
  | 'list'
  | 'assignees'
  | 'labels'
  | 'due_date'
  | 'start_date'
  | 'value';

export interface SortState {
  column: ColumnKey | null;
  direction: SortDirection;
}

export interface TableColumn {
  key: ColumnKey;
  label: string;
  sortable: boolean;
  width?: string;
}

export interface TableRowData extends Card {
  listTitle: string;
  listId: string;
}

export interface TableViewProps {
  cards: Card[];
  lists: Record<string, List>;
  onCardClick: (cardId: string) => void;
}
