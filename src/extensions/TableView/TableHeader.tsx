// TableHeader — renders sortable column headers for the TableView.
// Clicking a header cycles: unsorted → asc → desc → unsorted.
import type { TableColumn, SortState, ColumnKey } from './types';

interface Props {
  columns: TableColumn[];
  sortState: SortState;
  onSort: (column: ColumnKey) => void;
}

const SortIcon = ({ direction }: { direction: 'asc' | 'desc' | 'none' }) => {
  if (direction === 'none') {
    return <span className="ml-1 opacity-30 text-xs">↕</span>;
  }
  return <span className="ml-1 text-xs text-blue-400">{direction === 'asc' ? '↑' : '↓'}</span>;
};

const TableHeader = ({ columns, sortState, onSort }: Props) => {
  return (
    <thead>
      <tr className="border-b border-border">
        {columns.map((col) => (
          <th
            key={col.key}
            scope="col"
            className={`px-3 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wide select-none${col.sortable ? ' cursor-pointer hover:text-base' : ''}`}
            style={col.width ? { width: col.width } : undefined}
            onClick={col.sortable ? () => onSort(col.key) : undefined}
            aria-sort={
              sortState.column === col.key
                ? sortState.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            data-testid={`table-header-${col.key}`}
          >
            {col.label}
            {col.sortable && (
              <SortIcon
                direction={sortState.column === col.key ? sortState.direction : 'none'}
              />
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
};

export default TableHeader;
