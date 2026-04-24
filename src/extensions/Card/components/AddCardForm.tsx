// AddCardForm — inline card creation form shown at the bottom of a list column.
// Pressing Enter or clicking [Add card] submits; Escape or [X] dismisses.
import { useState, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';

interface Props {
  listId: string;
  onSubmit: (listId: string, title: string) => Promise<void>;
  onCancel: () => void;
}

const AddCardForm = ({ listId, onSubmit, onCancel }: Props) => {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the textarea when the form mounts
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(listId, trimmed);
      setTitle('');
      textareaRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 px-2 pt-2 pb-2">
      <textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Card title…"
        rows={2}
        disabled={submitting}
        className="w-full rounded-lg bg-bg-overlay border border-border px-2.5 pt-3 pb-2 text-sm leading-5 text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-subtle"
        aria-label="New card title"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          type="submit"
          disabled={!title.trim() || submitting}
        >
          Add card
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
};

export default AddCardForm;
