import { XMarkIcon } from '@heroicons/react/24/outline';
import translations from '../translations/en.json';

interface Props {
  onViewRules: () => void;
  onDismiss: () => void;
}

const TransitionsActiveBanner = ({ onViewRules, onDismiss }: Props) => (
  <div className="mx-4 mt-3 flex items-center justify-end gap-2">
    <button
      type="button"
      onClick={onViewRules}
      className="text-xs font-medium text-blue-200 hover:text-blue-100 hover:underline"
    >
      {translations['StateTransitions.activeBannerViewRules']}
    </button>
    <button
      type="button"
      onClick={onDismiss}
      className="rounded p-1 text-blue-200 hover:bg-blue-500/20 hover:text-blue-100"
      aria-label={translations['StateTransitions.activeBannerDismiss']}
    >
      <XMarkIcon className="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
);

export default TransitionsActiveBanner;
