// AddCardButtonButton — "Add button" CTA that opens the CardButtonBuilder.
import { PlusIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
import translations from '../../translations/en.json';

interface Props {
  onClick: () => void;
  disabled?: boolean;
}

const AddCardButtonButton: FC<Props> = ({ onClick, disabled = false }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="flex items-center gap-1.5 w-full rounded-md border border-dashed border-slate-600 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
    aria-label={translations['automation.addCardButton.ariaLabel']}
  >
    <PlusIcon className="h-4 w-4" aria-hidden="true" />
    {translations['automation.addCardButton.label']}
  </button>
);

export default AddCardButtonButton;
