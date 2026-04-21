// ListHeader — displays the list title with rename, archive, and delete actions.
// Styled for dark kanban board; supports inline editing with Enter/Escape/blur.
import { useState } from 'react';
import type { List } from '../api';
import Button from '../../../common/components/Button';
import type { ListSortBy } from '../types';

const SORT_OPTIONS: Array<{ value: ListSortBy; label: string }> = [
  { value: 'created-desc', label: 'Date created (newest first)' },
  { value: 'created-asc', label: 'Date created (oldest first)' },
  { value: 'card-name', label: 'Card name (alphabetically)' },
  { value: 'due-date', label: 'Due date' },
  { value: 'card-price', label: 'Card price' },
];

interface Props {
  list: List;
  cardCount?: number;
  onRename: (title: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onSortBy: (sortBy: ListSortBy) => void;
  /** When true the column sits over a board background image — apply frosted-glass styling. */
  hasBackground?: boolean;
}

const ListHeader = ({
  list,
  cardCount,
  onRename,
  onArchive,
  onDelete,
  onSortBy,
  hasBackground,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

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
            setSortMenuOpen(false);
          }}
          aria-label="List options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          ···
        </Button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-52 rounded-md border border-border bg-bg-surface py-1 shadow-xl">
            <Button
              variant="ghost"
              className="w-full justify-between px-4 py-2 text-sm rounded-none"
              onClick={() => {
                setSortMenuOpen((value) => !value);
              }}
              aria-haspopup="true"
              aria-expanded={sortMenuOpen}
            >
              <span>Sort by</span>
              <span aria-hidden="true">›</span>
            </Button>
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
              onClick={() => {
                setMenuOpen(false);
                setSortMenuOpen(false);
                onDelete();
              }}
            >
              Delete
            </Button>

            {sortMenuOpen && (
              <div className="absolute left-full top-0 ml-1 w-64 rounded-md border border-border bg-bg-surface shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-sm font-semibold">Sort list</p>
                  <Button
                    variant="ghost"
                    className="h-7 w-7 rounded p-0 text-subtle"
                    onClick={() => setSortMenuOpen(false)}
                    aria-label="Close sort menu"
                  >
                    ×
                  </Button>
                </div>
                <div className="py-1">
                  {SORT_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant="ghost"
                      className="w-full justify-start px-3 py-2 text-sm rounded-none"
                      onClick={() => {
                        onSortBy(option.value);
                        setSortMenuOpen(false);
                        setMenuOpen(false);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListHeader;
