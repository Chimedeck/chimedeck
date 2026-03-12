// AutomationHeaderButton — BoltIcon button with active-automation count badge.
// Placed immediately to the left of the board ··· menu button.
import { BoltIcon } from '@heroicons/react/24/solid';

interface Props {
  /** Number of currently enabled automations on this board. */
  activeCount: number;
  onClick: () => void;
}

const AutomationHeaderButton = ({ activeCount, onClick }: Props) => (
  <button
    className="relative rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
    onClick={onClick}
    aria-label="Open automation panel"
    title="Automation"
  >
    <BoltIcon className="h-5 w-5" aria-hidden="true" />
    {activeCount > 0 && (
      <span
        className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-none text-white"
        aria-label={`${activeCount} active automation${activeCount !== 1 ? 's' : ''}`}
      >
        {activeCount > 99 ? '99+' : activeCount}
      </span>
    )}
  </button>
);

export default AutomationHeaderButton;
