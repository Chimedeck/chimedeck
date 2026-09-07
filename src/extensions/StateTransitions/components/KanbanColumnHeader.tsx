import { LockClosedIcon } from '@heroicons/react/24/solid';
import translations from '../translations/en.json';

export const KanbanColumnLockIndicator = () => (
  <span
    className="inline-flex items-center text-muted"
    title={translations['StateTransitions.lockedColumnTooltip']}
    aria-label={translations['StateTransitions.lockedColumnAria']}
  >
    <LockClosedIcon className="h-3 w-3" aria-hidden="true" />
  </span>
);

export default KanbanColumnLockIndicator;
