// CardDueDate — datetime-local input with urgency highlighting and done checkbox.
import { CheckIcon } from '@heroicons/react/24/solid';

type DueDateStatus = 'done' | 'overdue' | 'due-soon' | 'normal';

function getDueDateStatus(dueDate: string, dueComplete: boolean): DueDateStatus {
  if (dueComplete) return 'done';
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  if (due < now) return 'overdue';
  if (due - now < 24 * 60 * 60 * 1000) return 'due-soon';
  return 'normal';
}

function getCheckboxClass(status: DueDateStatus): string {
  if (status === 'done') return 'bg-emerald-500 border-emerald-500';
  if (status === 'overdue') return 'bg-red-500 border-red-500';
  if (status === 'due-soon') return 'bg-orange-400 border-orange-400';
  return 'border-gray-300 bg-white';
}

interface Props {
  dueDate: string | null;
  dueComplete: boolean;
  onChange: (date: string | null) => void;
  onDoneChange: (done: boolean) => void;
  disabled?: boolean;
  label?: string;
}

const CardDueDate = ({ dueDate, dueComplete, onChange, onDoneChange, disabled, label = 'Due date' }: Props) => {
  const status = dueDate ? getDueDateStatus(dueDate, dueComplete) : 'normal';

  const checkboxBg = getCheckboxClass(status);

  // Convert stored ISO string to datetime-local value (strip seconds/tz)
  const localValue = dueDate
    ? new Date(dueDate).toISOString().slice(0, 16)
    : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {dueDate && (
          <button
            type="button"
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${checkboxBg} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => onDoneChange(!dueComplete)}
            aria-label={dueComplete ? 'Mark as not done' : 'Mark as done'}
            disabled={disabled}
          >
            {dueComplete && (
              <CheckIcon className="h-2.5 w-2.5 text-inverse" aria-hidden="true" />
            )}
          </button>
        )}
        <input
          type="datetime-local"
          className="flex-1 bg-bg-overlay border border-border rounded-lg px-2 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 [color-scheme:light]"
          value={localValue}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val ? new Date(val).toISOString() : null);
          }}
          disabled={disabled}
          aria-label={label}
        />
      </div>
      {dueDate && !disabled && (
        <button
          type="button"
          className="text-xs text-muted hover:text-gray-700 transition-colors"
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
};

export default CardDueDate;
