// AddListButton — inline form to create a new list at the end of the board.
import { useState } from 'react';

interface Props {
  onAdd: (title: string) => void;
}

const AddListButton = ({ onAdd }: Props) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        className="flex h-10 w-64 shrink-0 items-center gap-2 rounded-lg bg-bg-surface/70 px-3 text-sm font-medium text-muted shadow hover:bg-bg-surface hover:text-base"
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
      className="flex w-64 shrink-0 flex-col gap-2 rounded-lg bg-bg-surface p-3 shadow"
    >
      <input
        autoFocus
        type="text"
        placeholder="Enter list title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded border border-border-strong px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded bg-primary px-3 py-1 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50" // [theme-exception] text-white on primary button
        >
          Add list
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(''); }}
          className="rounded px-2 py-1 text-sm text-muted hover:bg-bg-overlay"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default AddListButton;
