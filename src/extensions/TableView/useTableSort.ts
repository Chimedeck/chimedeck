// useTableSort — manages column sort state and produces a sorted card list.
// Clicking the same column cycles: none → asc → desc → none.
import { useState, useMemo } from 'react';
import type { Card } from '../Card/api';
import type { List } from '../List/api';
import type { ColumnKey, SortDirection, SortState, TableRowData } from './types';

function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  // Treat null/undefined as sort-last
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const result = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

function cardSortValue(row: TableRowData, column: ColumnKey): unknown {
  switch (column) {
    case 'title':    return row.title;
    case 'list':     return row.listTitle;
    case 'assignees':return row.members.map((m) => m.name ?? m.email).join(', ');
    case 'labels':   return row.labels.map((l) => l.name).join(', ');
    case 'due_date': return row.due_date;
    case 'start_date': return row.start_date;
    case 'value':    return row.amount != null ? parseFloat(row.amount) : null;
    default:         return null;
  }
}

export function useTableSort({
  cards,
  lists,
}: {
  cards: Card[];
  lists: Record<string, List>;
}) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: 'none' });

  // Build flat rows with list titles
  const rows: TableRowData[] = useMemo(
    () =>
      cards.map((card) => ({
        ...card,
        listTitle: lists[card.list_id]?.title ?? '',
        listId: card.list_id,
      })),
    [cards, lists],
  );

  const sortedRows = useMemo(() => {
    if (!sortState.column || sortState.direction === 'none') return rows;
    const col = sortState.column;
    const dir = sortState.direction;
    return [...rows].sort((a, b) => compareValues(cardSortValue(a, col), cardSortValue(b, col), dir));
  }, [rows, sortState]);

  const handleSort = (column: ColumnKey) => {
    setSortState((prev) => {
      if (prev.column !== column) return { column, direction: 'asc' };
      // Cycle: asc → desc → none
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      if (prev.direction === 'desc') return { column: null, direction: 'none' };
      return { column, direction: 'asc' };
    });
  };

  return { sortedRows, sortState, handleSort };
}
