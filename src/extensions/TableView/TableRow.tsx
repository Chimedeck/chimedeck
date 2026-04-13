// TableRow — renders a single card as a table row in the TableView.
// Columns: Title (clickable → opens card modal), List, Assignees, Labels,
// Due Date (red if overdue), Start Date, Value.
import translations from './translations/en.json';
import type { TableRowData } from './types';
import Button from '../../common/components/Button';

/** Pick readable text colour (black or white) based on background luminance. */
function contrastText(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  if (hex.length < 6) return '#0f172a';
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.19 ? '#0f172a' : '#ffffff';
}

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

const MAX_VISIBLE_LABELS = 3;

const TableRow = ({ row, onCardClick }: Props) => {
  const overdue = isOverdue(row.due_date);
  const visibleLabels = row.labels.slice(0, MAX_VISIBLE_LABELS);
  const overflowCount = row.labels.length - MAX_VISIBLE_LABELS;

  return (
    <tr
      className="border-b border-border hover:bg-bg-overlay/40 transition-colors"
      data-testid={`table-row-${row.id}`}
    >
      {/* Title */}
      <td className="px-4 py-3">
        <Button
          variant="ghost"
          className="text-sm font-semibold text-base hover:text-primary justify-start underline-offset-2 hover:underline px-0 py-0"
          onClick={() => onCardClick(row.id)}
          aria-label={`${translations['TableView.ariaOpenCard']} ${row.title}`}
          data-testid={`table-card-title-${row.id}`}
        >
          {row.title}
        </Button>
      </td>

      {/* List — colored by common status keywords for quick scanning */}
      <td className="px-4 py-3 text-sm" data-testid={`table-cell-list-${row.id}`}>
        {(() => {
          const t = (row.listTitle ?? '').toLowerCase();
          let cls = 'text-muted';
          if (t.includes('done') || t.includes('complete') || t.includes('finished')) cls = 'text-success font-medium';
          else if (t.includes('backlog') || t.includes('todo') || t.includes('to do')) cls = 'text-warning font-medium';
          else if (t.includes('progress') || t.includes('doing') || t.includes('active')) cls = 'text-info font-medium';
          else if (t.includes('review') || t.includes('verify') || t.includes('test')) cls = 'text-accent font-medium';
          return <span className={cls}>{row.listTitle}</span>;
        })()}
      </td>

      {/* Assignees */}
      <td className="px-4 py-3" data-testid={`table-cell-assignees-${row.id}`}>
        <div className="flex flex-wrap gap-1">
          {(row.members ?? []).map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-700 text-xs font-bold text-white uppercase" // [theme-exception] text-white on colored avatar bg
              title={m.name ?? m.email}
              aria-label={m.name ?? m.email}
            >
              {(m.name ?? m.email).charAt(0)}
            </span>
          ))}
        </div>
      </td>

      {/* Labels — cap at MAX_VISIBLE_LABELS, show +N overflow badge */}
      <td className="px-4 py-3" data-testid={`table-cell-labels-${row.id}`}>
        <div className="flex flex-wrap gap-1">
          {visibleLabels.map((label) => (
            <span
              key={label.id}
              className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: label.color, color: contrastText(label.color) }}
              title={label.name}
              aria-label={label.name}
            >
              {label.name}
            </span>
          ))}
          {overflowCount > 0 && (
            <span
              className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-black/[0.06] text-gray-600"
              title={row.labels.slice(MAX_VISIBLE_LABELS).map((l) => l.name).join(', ')}
            >
              +{overflowCount}
            </span>
          )}
        </div>
      </td>

      {/* Due Date */}
      <td
        className={`px-4 py-3 text-sm${overdue ? ' text-danger font-medium' : ' text-muted'}`}
        data-testid={`table-cell-due-date-${row.id}`}
      >
        {row.due_date ? formatDate(row.due_date) : <span className="text-muted">—</span>}
      </td>

      {/* Start Date */}
      <td className="px-4 py-3 text-sm text-muted" data-testid={`table-cell-start-date-${row.id}`}>
        {row.start_date ? formatDate(row.start_date) : <span className="text-muted">—</span>}
      </td>

      {/* Value — right-aligned for financial readability */}
      <td className="px-4 py-3 text-sm text-right font-mono" data-testid={`table-cell-value-${row.id}`}>
        {row.amount != null ? (
          <span className="text-primary font-medium">
            {row.currency ?? ''}{' '}{Number.parseFloat(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  );
};

export default TableRow;
