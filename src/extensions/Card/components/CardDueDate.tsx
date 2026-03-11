// CardDueDate — native date input styled with Tailwind for the modal sidebar.
interface Props {
  dueDate: string | null;
  onChange: (date: string | null) => void;
  disabled?: boolean;
  label?: string;
}

const CardDueDate = ({ dueDate, onChange, disabled, label = 'Due date' }: Props) => {
  return (
    <div className="space-y-1">
      <input
        type="date"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 [color-scheme:dark]"
        value={dueDate ? dueDate.slice(0, 10) : ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        aria-label={label}
      />
      {dueDate && !disabled && (
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
};

export default CardDueDate;
