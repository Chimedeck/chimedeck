// AutomationHeaderButton — BoltIcon button with active-automation count badge.
// Placed immediately to the left of the board ··· menu button.
import { BoltIcon } from '@heroicons/react/24/solid';
import Button from '../../../common/components/Button';
import translations from '../translations/en.json';

interface Props {
  /** Number of currently enabled automations on this board. */
  activeCount: number;
  onClick: () => void;
}

const AutomationHeaderButton = ({ activeCount, onClick }: Props) => (
  <Button
    variant="ghost"
    size="icon"
    className="relative"
    onClick={onClick}
    aria-label={translations['automation.headerButton.ariaLabel']}
    title={translations['automation.panel.title']}
  >
    <BoltIcon className="h-5 w-5" aria-hidden="true" />
    {activeCount > 0 && (
      <span
        className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-none text-inverse"
        aria-label={`${activeCount} active automation${activeCount !== 1 ? 's' : ''}`}
      >
        {activeCount > 99 ? '99+' : activeCount}
      </span>
    )}
  </Button>
);

export default AutomationHeaderButton;
