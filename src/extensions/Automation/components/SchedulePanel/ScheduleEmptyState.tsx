// ScheduleEmptyState — shown when no SCHEDULED or DUE_DATE automations exist.
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import Button from '../../../../common/components/Button';
import translations from '../../translations/en.json';

interface Props {
  onCreateScheduled: () => void;
  onCreateDueDate: () => void;
}

const ScheduleEmptyState = ({ onCreateScheduled, onCreateDueDate }: Props) => (
  <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
    <CalendarDaysIcon className="h-10 w-10 text-muted" aria-hidden="true" />
    <div>
      <p className="text-sm font-medium text-subtle">{translations['automation.scheduleEmptyState.title']}</p>
      <p className="mt-1 text-xs text-muted">
        {translations['automation.scheduleEmptyState.description']}
      </p>
    </div>
    <div className="flex flex-col gap-2 w-full max-w-xs">
      <Button
        variant="primary"
        onClick={onCreateScheduled}
        className="w-full"
      >
        {translations['automation.scheduleEmptyState.createScheduled']}
      </Button>
      <Button
        variant="secondary"
        onClick={onCreateDueDate}
        className="w-full"
      >
        {translations['automation.scheduleEmptyState.createDueDate']}
      </Button>
    </div>
  </div>
);

export default ScheduleEmptyState;
