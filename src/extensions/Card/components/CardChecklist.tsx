// CardChecklist — checklist widget with progress bar, item list, and inline add.
// Wraps ChecklistSection + ChecklistProgress per sprint-19 spec.
// All mutations are optimistic (handled in parent container via callbacks).
import { ChecklistSection } from './ChecklistSection';
import type { ChecklistItem } from '../api';

interface Props {
  items: ChecklistItem[];
  onAdd: (title: string) => Promise<void>;
  onToggle: (itemId: string, checked: boolean) => Promise<void>;
  onRename: (itemId: string, title: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  disabled?: boolean;
}

const CardChecklist = ({ items, onAdd, onToggle, onRename, onDelete, disabled }: Props) => {
  const checked = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100);

  return (
    <section aria-label="Checklist">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Checklist
        </h3>
        <span className="text-xs text-slate-500">{checked}/{total}</span>
      </div>

      {total > 0 && (
        <div className="mb-3" aria-label={`Checklist progress: ${pct}%`}>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <ChecklistSection
        items={items}
        onAdd={onAdd}
        onToggle={onToggle}
        onRename={onRename}
        onDelete={onDelete}
        disabled={disabled}
      />
    </section>
  );
};

export default CardChecklist;
