import { XMarkIcon } from '@heroicons/react/24/outline';
import translations from '../../translations/en.json';

interface Props {
  onClick: () => void;
}

const EdgeDeleteButton = ({ onClick }: Props) => (
  <button
    type="button"
    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-bg-surface text-muted hover:bg-bg-overlay hover:text-base"
    aria-label={translations['StateTransitions.edgeDelete']}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    }}
  >
    <XMarkIcon className="h-3 w-3" aria-hidden="true" />
  </button>
);

export default EdgeDeleteButton;
