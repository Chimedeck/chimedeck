// AutomationEmptyState — shown in the Rules tab when the board has no automations.
import { BoltIcon, PlusIcon } from '@heroicons/react/24/outline';
import Button from '../../../../common/components/Button';
import translations from '../../translations/en.json';

interface Props {
  onCreateRule: () => void;
}

const AutomationEmptyState = ({ onCreateRule }: Props) => (
  <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
    <div className="rounded-full bg-bg-surface p-4">
      <BoltIcon className="h-8 w-8 text-muted" aria-hidden="true" />
    </div>
    <div>
      <p className="text-subtle font-medium">{translations['automation.emptyState.title']}</p>
      <p className="mt-1 text-sm text-muted">
        {translations['automation.emptyState.description']}
      </p>
    </div>
    <Button
      variant="primary"
      onClick={onCreateRule}
      className="flex items-center gap-2"
    >
      <PlusIcon className="h-4 w-4" aria-hidden="true" />
      {translations['automation.emptyState.createRule']}
    </Button>
  </div>
);

export default AutomationEmptyState;
