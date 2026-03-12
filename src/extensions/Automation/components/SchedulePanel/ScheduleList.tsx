// ScheduleList — lists all SCHEDULED and DUE_DATE automations, grouped by type.
import type { FC } from 'react';
import type { Automation } from '../../types';
import ScheduleItem from './ScheduleItem';
import { PlusIcon } from '@heroicons/react/24/outline';

interface Props {
  boardId: string;
  automations: Automation[];
  onCreateScheduled: () => void;
  onCreateDueDate: () => void;
  onEdit: (automation: Automation) => void;
  onChanged: () => void;
}

const ScheduleList: FC<Props> = ({
  boardId,
  automations,
  onCreateScheduled,
  onCreateDueDate,
  onEdit,
  onChanged,
}) => {
  const scheduled = automations.filter((a) => a.automationType === 'SCHEDULED');
  const dueDates = automations.filter((a) => a.automationType === 'DUE_DATE');

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      {/* Scheduled commands section */}
      <section aria-labelledby="scheduled-heading">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="scheduled-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Scheduled Commands
          </h3>
          <button
            onClick={onCreateScheduled}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-400 hover:bg-slate-700 transition-colors"
            aria-label="Create scheduled command"
          >
            <PlusIcon className="h-3 w-3" aria-hidden="true" />
            Add
          </button>
        </div>
        {scheduled.length > 0 ? (
          <ul className="flex flex-col gap-2" role="list">
            {scheduled.map((a) => (
              <ScheduleItem
                key={a.id}
                boardId={boardId}
                automation={a}
                onEdit={() => onEdit(a)}
                onDeleted={onChanged}
                onToggled={onChanged}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 italic">No scheduled commands yet.</p>
        )}
      </section>

      {/* Due date commands section */}
      <section aria-labelledby="duedate-heading">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="duedate-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Due Date Commands
          </h3>
          <button
            onClick={onCreateDueDate}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-400 hover:bg-slate-700 transition-colors"
            aria-label="Create due date command"
          >
            <PlusIcon className="h-3 w-3" aria-hidden="true" />
            Add
          </button>
        </div>
        {dueDates.length > 0 ? (
          <ul className="flex flex-col gap-2" role="list">
            {dueDates.map((a) => (
              <ScheduleItem
                key={a.id}
                boardId={boardId}
                automation={a}
                onEdit={() => onEdit(a)}
                onDeleted={onChanged}
                onToggled={onChanged}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 italic">No due date commands yet.</p>
        )}
      </section>
    </div>
  );
};

export default ScheduleList;
