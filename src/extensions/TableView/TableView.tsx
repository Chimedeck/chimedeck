// TableView — flat spreadsheet-style view of all cards on a board.
// Sprint 52: displays all non-archived cards from the board's Redux state.
// Columns: Title, List, Assignees, Labels, Due Date, Start Date, Value.
// All columns are sortable; clicking Title opens the card detail modal.
import { useTableSort } from './useTableSort';
import TableHeader from './TableHeader';
import TableRow from './TableRow';
import type { TableColumn, TableViewProps } from './types';

const COLUMNS: TableColumn[] = [
  { key: 'title',      label: 'Title',      sortable: true,  width: '220px' },
  { key: 'list',       label: 'List',       sortable: true,  width: '140px' },
  { key: 'assignees',  label: 'Assignees',  sortable: true,  width: '120px' },
  { key: 'labels',     label: 'Labels',     sortable: true,  width: '160px' },
  { key: 'due_date',   label: 'Due Date',   sortable: true,  width: '120px' },
  { key: 'start_date', label: 'Start Date', sortable: true,  width: '120px' },
  { key: 'value',      label: 'Value',      sortable: true,  width: '100px' },
];

const TableView = ({ cards, lists, onCardClick }: TableViewProps) => {
  const { sortedRows, sortState, handleSort } = useTableSort({ cards, lists });

  if (cards.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center py-24 text-slate-500"
        data-testid="table-view-empty"
      >
        No cards on this board yet.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4" data-testid="table-view">
      <table className="w-full border-collapse text-left">
        <TableHeader columns={COLUMNS} sortState={sortState} onSort={handleSort} />
        <tbody>
          {sortedRows.map((row) => (
            <TableRow key={row.id} row={row} onCardClick={onCardClick} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableView;
