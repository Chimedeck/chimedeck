// AutomationEmptyState — shown in the Rules tab when the board has no automations.
import { BoltIcon, PlusIcon } from '@heroicons/react/24/outline';
import translations from '../../translations/en.json';

interface Props {
  onCreateRule: () => void;
}

const AutomationEmptyState = ({ onCreateRule }: Props) => (
  <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
    <div className="rounded-full bg-slate-800 p-4">
      <BoltIcon className="h-8 w-8 text-slate-500" aria-hidden="true" />
    </div>
    <div>
      <p className="text-slate-200 font-medium">{translations['automation.emptyState.title']}</p>
      <p className="mt-1 text-sm text-slate-400">
        {translations['automation.emptyState.description']}
      </p>
    </div>
    <button
      className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
      onClick={onCreateRule}
    >
      <PlusIcon className="h-4 w-4" aria-hidden="true" />
      {translations['automation.emptyState.createRule']}
    </button>
  </div>
);

export default AutomationEmptyState;
