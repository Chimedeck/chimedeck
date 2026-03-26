// BoardDeleteDialog — confirms deletion of a board that contains lists/cards.
// Shows the number of lists and cards that will be permanently removed,
// then sends confirm:true in the DELETE request body.
import { useState } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Button from '~/common/components/Button';

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
      <div className="w-full max-w-md rounded-xl bg-bg-base border border-border p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-danger shrink-0" />
            <h2 className="text-lg font-semibold text-base">Delete board?</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted hover:text-subtle transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-subtle mb-2">
          <span className="font-medium text-base">"{boardTitle}"</span> contains:
        </p>
        <ul className="text-sm text-muted mb-4 list-disc list-inside space-y-1">
          <li>{listCount} list{listCount !== 1 ? 's' : ''}</li>
          <li>{cardCount} card{cardCount !== 1 ? 's' : ''}</li>
        </ul>
        <p className="text-sm text-danger mb-6">
          All of this content will be permanently deleted. This cannot be undone.
        </p>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="danger" size="md" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete board'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BoardDeleteDialog;
