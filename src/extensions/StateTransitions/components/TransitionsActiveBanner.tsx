import { ArrowsRightLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import translations from '../translations/en.json';

interface Props {
  onViewRules: () => void;
  onDismiss: () => void;
}

const TransitionsActiveBanner = ({ onViewRules, onDismiss }: Props) => (
  <div className="mx-4 mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
    <div className="flex items-start gap-3">
      <ArrowsRightLeftIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
      <p className="flex-1 text-sm text-blue-100">
        {translations['StateTransitions.activeBannerText']}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 text-blue-200 hover:bg-blue-500/20 hover:text-blue-100"
        aria-label={translations['StateTransitions.activeBannerDismiss']}
      >
        <XMarkIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <div className="mt-2 flex justify-end">
      <button
        type="button"
        onClick={onViewRules}
        className="text-xs font-medium text-blue-200 hover:text-blue-100 hover:underline"
      >
        {translations['StateTransitions.activeBannerViewRules']}
      </button>
    </div>
  </div>
);

export default TransitionsActiveBanner;
