// ListDeleteDialog — confirms deletion of a list that contains cards.
// Shows the number of cards that will be permanently removed,
// then sends confirm:true in the DELETE request body.
import { useState } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Button from '~/common/components/Button';
import IconButton from '~/common/components/IconButton';

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
      <div className="w-full max-w-md rounded-xl bg-bg-surface border border-border p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-danger shrink-0" />
            <h2 className="text-lg font-semibold text-base">Delete list?</h2>
          </div>
          <IconButton
            type="button"
            onClick={onCancel}
            aria-label="Close"
            icon={<XMarkIcon className="w-5 h-5" aria-hidden="true" />}
            variant="ghost"
          />
        </div>

        <p className="text-sm text-base mb-2">
          <span className="font-medium text-base">"{listTitle}"</span> contains{' '}
          <span className="font-medium text-base">{cardCount}</span> card{cardCount !== 1 ? 's' : ''}.
        </p>
        <p className="text-sm text-danger mb-6">
          All cards in this list will be permanently deleted. This cannot be undone.
        </p>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="danger" size="md" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete list'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ListDeleteDialog;
