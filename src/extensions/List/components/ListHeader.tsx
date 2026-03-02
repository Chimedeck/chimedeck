// ListHeader — displays the list title with rename, archive, and delete actions.
import { useState } from 'react';
import type { List } from '../api';

interface Props {
  list: List;
  onRename: (title: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}

const ListHeader = ({ list, onRename, onArchive, onDelete }: Props) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || trimmed === list.title) {
      setEditing(false);
      setTitle(list.title);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-1">
      {editing ? (
        <form onSubmit={handleRename} className="flex-1">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleRename}
            className="w-full rounded border border-blue-400 px-2 py-1 text-sm font-semibold focus:outline-none"
          />
        </form>
      ) : (
        <button
          className="flex-1 text-left text-sm font-semibold text-gray-900 hover:text-blue-600"
          onClick={() => { setEditing(true); setTitle(list.title); }}
          aria-label={`Rename list ${list.title}`}
        >
          {list.title}
        </button>
      )}

      <div className="relative ml-2">
        <button
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="List options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          ···
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            <button
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => { setMenuOpen(false); setEditing(true); setTitle(list.title); }}
            >
              Rename
            </button>
            <button
              className="block w-full px-4 py-2 text-left text-sm text-yellow-700 hover:bg-yellow-50"
              onClick={() => { setMenuOpen(false); onArchive(); }}
            >
              {list.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={() => { setMenuOpen(false); onDelete(); }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListHeader;
