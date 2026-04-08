// TableView — flat spreadsheet-style view of all cards on a board.
// Sprint 52: displays all non-archived cards from the board's Redux state.
// Columns: Title, List, Assignees, Labels, Due Date, Start Date, Value.
// All columns are sortable; clicking Title opens the card detail modal.
import { useTableSort } from './useTableSort';
import TableHeader from './TableHeader';
import TableRow from './TableRow';
import translations from './translations/en.json';
import type { TableColumn, TableViewProps } from './types';

const COLUMNS: TableColumn[] = [
  { key: 'title',      label: translations['TableView.columnTitle'],      sortable: true,  width: '280px' },
  { key: 'list',       label: translations['TableView.columnList'],       sortable: true,  width: '130px' },
  { key: 'assignees',  label: translations['TableView.columnMembers'],    sortable: true,  width: '100px' },
  { key: 'labels',     label: translations['TableView.columnLabels'],     sortable: true,  width: '200px' },
  { key: 'due_date',   label: translations['TableView.columnDueDate'],    sortable: true,  width: '110px' },
  { key: 'start_date', label: translations['TableView.columnStartDate'],  sortable: true,  width: '110px' },
  { key: 'value',      label: translations['TableView.columnMoney'],      sortable: true,  width: '100px' },
];

const TableView = ({ cards, lists, onCardClick }: TableViewProps) => {
  const { sortedRows, sortState, handleSort } = useTableSort({ cards, lists });

  if (cards.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center py-24 text-muted"
        data-testid="table-view-empty"
      >
        {translations['TableView.noCards']}
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto px-6 py-4 bg-bg-base"
      data-testid="table-view"
    >
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
