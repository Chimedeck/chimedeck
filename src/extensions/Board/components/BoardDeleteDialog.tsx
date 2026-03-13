// BoardDeleteDialog — confirms deletion of a board that contains lists/cards.
// Shows the number of lists and cards that will be permanently removed,
// then sends confirm:true in the DELETE request body.
import { useState } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  boardTitle: string;
  listCount: number;
  cardCount: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const BoardDeleteDialog = ({ boardTitle, listCount, cardCount, onConfirm, onCancel }: Props) => {
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
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-400 shrink-0" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Delete board?</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-700 dark:text-slate-300 mb-2">
          <span className="font-medium text-gray-900 dark:text-slate-100">"{boardTitle}"</span> contains:
        </p>
        <ul className="text-sm text-gray-500 dark:text-slate-400 mb-4 list-disc list-inside space-y-1">
          <li>{listCount} list{listCount !== 1 ? 's' : ''}</li>
          <li>{cardCount} card{cardCount !== 1 ? 's' : ''}</li>
        </ul>
        <p className="text-sm text-red-500 dark:text-red-400 mb-6">
          All of this content will be permanently deleted. This cannot be undone.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete board'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoardDeleteDialog;
