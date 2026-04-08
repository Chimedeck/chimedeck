// AddListForm — inline form shown after the last column to create a new list.
// Styled per sprint-18 spec §4 (dashed border add-list column).
import { useState, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  onSubmit: (title: string) => Promise<void>;
}

const AddListForm = ({ onSubmit }: Props) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setTitle('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setTitle('');
    }
  };

  if (!open) {
    return (
      <button
        className="w-72 shrink-0 bg-bg-surface/40 border border-dashed border-border rounded-xl p-3 text-subtle hover:text-base hover:border-border-strong text-sm text-left transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Add a list"
      >
        + Add a list
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-72 shrink-0 bg-bg-surface border border-border rounded-xl p-3 flex flex-col gap-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="List title…"
        disabled={submitting}
        className="rounded-lg bg-bg-overlay border border-border text-base text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-subtle"
        aria-label="New list title"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim() || submitting}
          className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition-colors" // [theme-exception] text-white on primary button
        >
          Add list
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(''); }}
          className="rounded-md px-2 py-1 text-subtle hover:text-base hover:bg-bg-overlay transition-colors"
          aria-label="Cancel"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
};

export default AddListForm;
