// ScheduleEmptyState — shown when no SCHEDULED or DUE_DATE automations exist.
import { CalendarDaysIcon } from '@heroicons/react/24/outline';

interface Props {
  onCreateScheduled: () => void;
  onCreateDueDate: () => void;
}

const ScheduleEmptyState = ({ onCreateScheduled, onCreateDueDate }: Props) => (
  <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
    <CalendarDaysIcon className="h-10 w-10 text-slate-500" aria-hidden="true" />
    <div>
      <p className="text-sm font-medium text-slate-200">No scheduled commands yet</p>
      <p className="mt-1 text-xs text-slate-400">
        Run actions on a calendar schedule or when cards approach their due date.
      </p>
    </div>
    <div className="flex flex-col gap-2 w-full max-w-xs">
      <button
        onClick={onCreateScheduled}
        className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
      >
        Create a scheduled command
      </button>
      <button
        onClick={onCreateDueDate}
        className="rounded-md border border-slate-600 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
      >
        Create a due date command
      </button>
    </div>
  </div>
);

export default ScheduleEmptyState;
