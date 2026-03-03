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
        className="w-72 shrink-0 bg-slate-900/40 border border-dashed border-slate-700 rounded-xl p-3 text-slate-400 hover:text-slate-200 hover:border-slate-500 text-sm text-left transition-colors"
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
      className="w-72 shrink-0 bg-slate-900/80 border border-slate-700 rounded-xl p-3 flex flex-col gap-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="List title…"
        disabled={submitting}
        className="rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
        aria-label="New list title"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim() || submitting}
          className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          Add list
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(''); }}
          className="rounded-md px-2 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          aria-label="Cancel"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
};

export default AddListForm;
