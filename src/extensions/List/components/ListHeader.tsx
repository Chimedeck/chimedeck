// ListHeader — displays the list title with rename, archive, and delete actions.
// Styled for dark kanban board; supports inline editing with Enter/Escape/blur.
import { useState } from 'react';
import type { List } from '../api';
import Button from '../../../common/components/Button';

interface Props {
  list: List;
  cardCount?: number;
  onRename: (title: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  /** When true the column sits over a board background image — apply frosted-glass styling. */
  hasBackground?: boolean;
}

const ListHeader = ({ list, cardCount, onRename, onArchive, onDelete, hasBackground }: Props) => {
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
    // [why] The header is wrapped by dnd-kit keyboard listeners; stop bubbling so
    // typing (especially Space) edits the input instead of triggering drag behavior.
    e.stopPropagation();
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { setTitle(list.title); setEditing(false); }
  };

  return (
    <div className={`px-3 pt-3 pb-2 flex items-center justify-between rounded-t-xl${hasBackground ? ' backdrop-blur-md bg-bg-surface/75' : ''}`}>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          className="bg-transparent text-base font-semibold text-sm focus:outline-none focus:bg-bg-overlay rounded px-1 py-0.5 w-full"
          aria-label={`Rename list ${list.title}`}
        />
      ) : (
        <Button
          variant="ghost"
          className="flex-1 justify-start text-sm font-semibold px-1 py-0.5"
          onClick={() => { setEditing(true); setTitle(list.title); }}
          aria-label={`Rename list ${list.title}`}
        >
          {list.title}
          {cardCount !== undefined && (
            <span className="ml-1.5 text-xs font-normal text-muted">({cardCount})</span>
          )}
        </Button>
      )}

      <div className="relative ml-2">
        <Button
          variant="ghost"
          className="rounded p-1 text-subtle"
          onClick={() => {
            setMenuOpen((v) => !v);
          }}
          aria-label="List options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          ···
        </Button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-border bg-bg-surface py-1 shadow-xl">
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-sm rounded-none"
              onClick={() => { setMenuOpen(false); setEditing(true); setTitle(list.title); }}
            >
              Rename
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-sm text-amber-700 dark:text-yellow-400 hover:text-amber-700 dark:hover:text-yellow-400 rounded-none"
              onClick={() => { setMenuOpen(false); onArchive(); }}
            >
              {list.archived ? 'Unarchive' : 'Archive'}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-sm text-danger hover:text-danger rounded-none"
              onClick={() => { setMenuOpen(false); onDelete(); }}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListHeader;
