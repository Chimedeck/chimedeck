// ListHeader — displays the list title with rename, archive, and delete actions.
// Styled for dark kanban board; supports inline editing with Enter/Escape/blur.
import { useState } from 'react';
import type { List } from '../api';

interface Props {
  list: List;
  cardCount?: number;
  onRename: (title: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}

const ListHeader = ({ list, cardCount, onRename, onArchive, onDelete }: Props) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [menuOpen, setMenuOpen] = useState(false);

  const commitRename = () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === list.title) {
      setEditing(false);
      setTitle(list.title);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { setTitle(list.title); setEditing(false); }
  };

  return (
    <div className="px-3 pt-3 pb-2 flex items-center justify-between">
      {editing ? (
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          className="bg-transparent text-gray-900 dark:text-slate-100 font-semibold text-sm focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-800 rounded px-1 py-0.5 w-full"
          aria-label={`Rename list ${list.title}`}
        />
      ) : (
        <button
          className="flex-1 text-left text-sm font-semibold text-gray-900 dark:text-slate-100 hover:text-black dark:hover:text-white"
          onClick={() => { setEditing(true); setTitle(list.title); }}
          aria-label={`Rename list ${list.title}`}
        >
          {list.title}
          {cardCount !== undefined && (
            <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-slate-400">({cardCount})</span>
          )}
        </button>
      )}

      <div className="relative ml-2">
        <button
          className="rounded p-1 text-gray-400 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="List options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          ···
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-xl">
            <button
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
              onClick={() => { setMenuOpen(false); setEditing(true); setTitle(list.title); }}
            >
              Rename
            </button>
            <button
              className="block w-full px-4 py-2 text-left text-sm text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-slate-700"
              onClick={() => { setMenuOpen(false); onArchive(); }}
            >
              {list.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              className="block w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700"
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
