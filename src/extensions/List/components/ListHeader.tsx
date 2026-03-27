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
          className="bg-transparent text-base font-semibold text-sm focus:outline-none focus:bg-bg-overlay rounded px-1 py-0.5 w-full"
          aria-label={`Rename list ${list.title}`}
        />
      ) : (
        <button
          className="flex-1 text-left text-sm font-semibold text-base hover:text-base"
          onClick={() => { setEditing(true); setTitle(list.title); }}
          aria-label={`Rename list ${list.title}`}
        >
          {list.title}
          {cardCount !== undefined && (
            <span className="ml-1.5 text-xs font-normal text-muted">({cardCount})</span>
          )}
        </button>
      )}

      <div className="relative ml-2">
        <button
          className="rounded p-1 text-subtle hover:bg-bg-overlay hover:text-base transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="List options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          ···
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-border bg-bg-surface py-1 shadow-xl">
            <button
              className="block w-full px-4 py-2 text-left text-sm text-base hover:bg-bg-overlay"
              onClick={() => { setMenuOpen(false); setEditing(true); setTitle(list.title); }}
            >
              Rename
            </button>
            <button
              className="block w-full px-4 py-2 text-left text-sm text-amber-700 dark:text-yellow-400 hover:bg-bg-overlay"
              onClick={() => { setMenuOpen(false); onArchive(); }}
            >
              {list.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-bg-overlay"
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
