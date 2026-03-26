// TableRow — renders a single card as a table row in the TableView.
// Columns: Title (clickable → opens card modal), List, Assignees, Labels,
// Due Date (red if overdue), Start Date, Value.
import translations from './translations/en.json';
import type { TableRowData } from './types';

interface Props {
  row: TableRowData;
  onCardClick: (cardId: string) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

const TableRow = ({ row, onCardClick }: Props) => {
  const overdue = isOverdue(row.due_date);

  return (
    <tr
      className="border-b border-border hover:bg-bg-surface/50 transition-colors"
      data-testid={`table-row-${row.id}`}
    >
      {/* Title */}
      <td className="px-3 py-2">
        <button
          className="text-sm font-medium text-base hover:text-blue-400 text-left underline-offset-2 hover:underline focus:outline-none"
          onClick={() => onCardClick(row.id)}
          aria-label={`${translations['TableView.ariaOpenCard']} ${row.title}`}
          data-testid={`table-card-title-${row.id}`}
        >
          {row.title}
        </button>
      </td>

      {/* List */}
      <td className="px-3 py-2 text-sm text-muted" data-testid={`table-cell-list-${row.id}`}>
        {row.listTitle}
      </td>

      {/* Assignees */}
      <td className="px-3 py-2" data-testid={`table-cell-assignees-${row.id}`}>
        <div className="flex flex-wrap gap-1">
          {(row.members ?? []).map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-700 text-xs font-bold text-white uppercase"
              title={m.name ?? m.email}
              aria-label={m.name ?? m.email}
            >
              {(m.name ?? m.email).charAt(0)}
            </span>
          ))}
        </div>
      </td>

      {/* Labels */}
      <td className="px-3 py-2" data-testid={`table-cell-labels-${row.id}`}>
        <div className="flex flex-wrap gap-1">
          {row.labels.map((label) => (
            <span
              key={label.id}
              className="inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: label.color }}
              title={label.name}
              aria-label={label.name}
            >
              {label.name}
            </span>
          ))}
        </div>
      </td>

      {/* Due Date */}
      <td
        className={`px-3 py-2 text-sm${overdue ? ' text-red-400 font-medium' : ' text-muted'}`}
        data-testid={`table-cell-due-date-${row.id}`}
      >
        {row.due_date ? formatDate(row.due_date) : <span className="text-muted">—</span>}
      </td>

      {/* Start Date */}
      <td className="px-3 py-2 text-sm text-muted" data-testid={`table-cell-start-date-${row.id}`}>
        {row.start_date ? formatDate(row.start_date) : <span className="text-muted">—</span>}
      </td>

      {/* Value */}
      <td className="px-3 py-2 text-sm text-muted" data-testid={`table-cell-value-${row.id}`}>
        {row.amount != null ? (
          <span>
            {row.currency ?? ''} {parseFloat(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  );
};

export default TableRow;
