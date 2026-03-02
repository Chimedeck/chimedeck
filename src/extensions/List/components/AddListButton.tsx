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
        className="flex h-10 w-64 shrink-0 items-center gap-2 rounded-lg bg-white/70 px-3 text-sm font-medium text-gray-600 shadow hover:bg-white hover:text-gray-900"
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
      className="flex w-64 shrink-0 flex-col gap-2 rounded-lg bg-white p-3 shadow"
    >
      <input
        autoFocus
        type="text"
        placeholder="Enter list title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add list
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(''); }}
          className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default AddListButton;
