// CreateCardForm — inline form for creating a new card at the bottom of a list.
import { useState } from 'react';
import Button from '../../../common/components/Button';

interface Props {
  listId: string;
  onSubmit: (listId: string, title: string) => Promise<void>;
  onCancel: () => void;
}

const CreateCardForm = ({ listId, onSubmit, onCancel }: Props) => {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }
    if (trimmed.length > 512) {
      setError('Title must be 512 characters or fewer');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(listId, trimmed);
      setTitle('');
    } catch {
      setError('Failed to create card');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        className="w-full rounded border border-border bg-bg-overlay p-2 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        placeholder="Enter a title for this card…"
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        aria-label="New card title"
        disabled={submitting}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          className="px-3 py-1 text-sm"
        >
          Add card
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default CreateCardForm;
