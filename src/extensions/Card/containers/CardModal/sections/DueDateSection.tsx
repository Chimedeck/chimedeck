// DueDateSection — displays and allows editing the card due date.
interface Props {
  dueDate: string | null;
  onChange: (dueDate: string | null) => Promise<void>;
  disabled?: boolean;
}

export const DueDateSection = ({ dueDate, onChange, disabled }: Props) => (
  <section aria-label="Due date">
    <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-slate-300">Due date</h3>
    <div className="flex items-center gap-2">
      <input
        type="date"
        className="rounded border border-gray-200 dark:border-gray-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none disabled:opacity-50 bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200"
        value={dueDate ? dueDate.split('T')[0] : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        disabled={disabled}
        aria-label="Due date"
      />
      {dueDate && !disabled && (
        <button
          type="button"
          className="text-xs text-gray-400 dark:text-slate-400 hover:text-red-500"
          onClick={() => onChange(null)}
          aria-label="Clear due date"
        >
          Clear
        </button>
      )}
    </div>
  </section>
);
