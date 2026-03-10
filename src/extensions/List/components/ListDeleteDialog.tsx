// ListDeleteDialog — confirms deletion of a list that contains cards.
// Shows the number of cards that will be permanently removed,
// then sends confirm:true in the DELETE request body.
import { useState } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  listTitle: string;
  cardCount: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const ListDeleteDialog = ({ listTitle, cardCount, onConfirm, onCancel }: Props) => {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-400 shrink-0" />
            <h2 className="text-lg font-semibold text-slate-100">Delete list?</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-2">
          <span className="font-medium text-slate-100">"{listTitle}"</span> contains{' '}
          <span className="font-medium text-slate-100">{cardCount}</span> card{cardCount !== 1 ? 's' : ''}.
        </p>
        <p className="text-sm text-red-400 mb-6">
          All cards in this list will be permanently deleted. This cannot be undone.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete list'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListDeleteDialog;
