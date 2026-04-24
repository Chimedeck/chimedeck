// ListHeader — displays the list title with rename, archive, and delete actions.
// Styled for dark kanban board; supports inline editing with Enter/Escape/blur.
import { memo, useState } from 'react';
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
  onAddCard: () => void;
  onCopyList: () => void;
  onMoveList: (targetIndex: number) => void;
  onMoveAllCards: (targetListId: string) => void;
  onArchive: () => void;
  onArchiveAllCards: () => void;
  onDelete: () => void;
  onSortBy: (sortBy: ListSortBy) => void;
  onChangeListColor: (color: string | null) => void;
  listColor?: string | null;
  textTone?: 'light' | 'dark';
  availableLists?: Array<{ id: string; title: string }>;
  /** When true the column sits over a board background image — apply frosted-glass styling. */
  hasBackground?: boolean;
}

const LIST_COLORS = ['#0F766E', '#B45309', '#D97706', '#C2410C', '#DC2626', '#7C3AED', '#2563EB', '#0E7490', '#4D7C0F', '#BE185D'];

const ListHeader = ({
  list,
  cardCount,
  onRename,
  onAddCard,
  onCopyList,
  onMoveList,
  onMoveAllCards,
  onArchive,
  onArchiveAllCards,
  onDelete,
  onSortBy,
  onChangeListColor,
  listColor = null,
  textTone = 'dark',
  availableLists = [],
  hasBackground,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [moveListMenuOpen, setMoveListMenuOpen] = useState(false);
  const [moveCardsMenuOpen, setMoveCardsMenuOpen] = useState(false);
  const hasCustomColor = Boolean(listColor);
  let toneTextClass = 'text-base';
  let toneMutedClass = 'text-muted';
  let toneButtonHoverClass = 'hover:bg-bg-overlay hover:text-subtle';
  let inputFocusClass = 'focus:bg-bg-overlay';

  if (hasCustomColor) {
    if (textTone === 'light') {
      toneTextClass = 'text-white';
      toneMutedClass = 'text-white/80';
      toneButtonHoverClass = 'hover:bg-white/15 hover:text-white';
      inputFocusClass = 'focus:bg-white/15';
    } else {
      toneTextClass = 'text-black';
      toneMutedClass = 'text-black/70';
      toneButtonHoverClass = 'hover:bg-black/10 hover:text-black';
      inputFocusClass = 'focus:bg-black/10';
    }
  }

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

  const stopMenuEventPropagation = (event: React.SyntheticEvent) => {
    // [why] Header is a sortable drag handle. Prevent menu interactions from
    // bubbling into dnd-kit pointer listeners, which can swallow clicks.
    event.stopPropagation();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // [why] The header is wrapped by dnd-kit keyboard listeners; stop bubbling so
    // typing (especially Space) edits the input instead of triggering drag behavior.
    e.stopPropagation();
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { setTitle(list.title); setEditing(false); }
  };

  return (
    <div className={`px-3 pt-3 pb-2 flex items-center justify-between rounded-t-xl${hasBackground && !listColor ? ' backdrop-blur-md bg-bg-surface/75' : ''}`}>
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
          className={`bg-transparent text-base font-semibold text-sm focus:outline-none rounded px-1 py-0.5 w-full ${toneTextClass} ${inputFocusClass}`}
          aria-label={`Rename list ${list.title}`}
        />
      ) : (
        <Button
          variant="ghost"
          className={`flex-1 justify-start text-sm font-semibold px-1 py-0.5 ${toneTextClass} ${toneButtonHoverClass}`}
          onClick={() => { setEditing(true); setTitle(list.title); }}
          aria-label={`Rename list ${list.title}`}
        >
          {list.title}
          {cardCount !== undefined && (
            <span className={`ml-1.5 text-xs font-normal ${toneMutedClass}`}>({cardCount})</span>
          )}
        </Button>
      )}

      <div className="relative ml-2 z-50" onMouseDown={stopMenuEventPropagation} onPointerDown={stopMenuEventPropagation}>
        <Button
          variant="ghost"
          className={`rounded p-1 ${toneMutedClass} ${toneButtonHoverClass}`}
          onMouseDown={stopMenuEventPropagation}
          onPointerDown={stopMenuEventPropagation}
          onClick={(event) => {
            stopMenuEventPropagation(event);
            setMenuOpen((v) => !v);
            setSortMenuOpen(false);
            setMoveListMenuOpen(false);
            setMoveCardsMenuOpen(false);
          }}
          aria-label="List options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          ···
        </Button>
        {menuOpen && (
          <div
            className="absolute right-0 z-[80] mt-1 w-52 rounded-md border border-border bg-bg-surface py-1 text-base shadow-xl pointer-events-auto"
            onMouseDown={stopMenuEventPropagation}
            onPointerDown={stopMenuEventPropagation}
          >
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-sm rounded-none"
              onClick={() => {
                onAddCard();
                setMenuOpen(false);
              }}
            >
              Add card
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-sm rounded-none"
              onClick={() => {
                onCopyList();
                setMenuOpen(false);
              }}
            >
              Copy list
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-between px-4 py-2 text-sm rounded-none"
              onClick={() => {
                setMoveListMenuOpen((value) => !value);
                setMoveCardsMenuOpen(false);
                setSortMenuOpen(false);
              }}
              aria-haspopup="true"
              aria-expanded={moveListMenuOpen}
            >
              <span>Move list</span>
              <span aria-hidden="true">›</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-between px-4 py-2 text-sm rounded-none"
              onClick={() => {
                setMoveCardsMenuOpen((value) => !value);
                setMoveListMenuOpen(false);
                setSortMenuOpen(false);
              }}
              aria-haspopup="true"
              aria-expanded={moveCardsMenuOpen}
            >
              <span>Move all cards in this list</span>
              <span aria-hidden="true">›</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-between px-4 py-2 text-sm rounded-none"
              onClick={() => {
                setSortMenuOpen((value) => !value);
                setMoveListMenuOpen(false);
                setMoveCardsMenuOpen(false);
              }}
              aria-haspopup="true"
              aria-expanded={sortMenuOpen}
            >
              <span>Sort by</span>
              <span aria-hidden="true">›</span>
            </Button>
            <div className="my-1 border-t border-border" />
            <div className="px-4 pb-2 pt-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Change list color</p>
              <div className="grid grid-cols-5 gap-2">
                {LIST_COLORS.map((color) => {
                  const selected = listColor?.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      className={`relative h-5 rounded ${selected ? 'ring-2 ring-offset-1 ring-indigo-500 ring-offset-bg-surface' : ''}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Set list color ${color}`}
                      onClick={() => onChangeListColor(color)}
                    >
                      {selected ? <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-white">✓</span> : null}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                className="mt-2 w-full justify-start px-2 py-1 text-xs rounded"
                onClick={() => onChangeListColor(null)}
              >
                Remove color
              </Button>
            </div>
            <div className="my-1 border-t border-border" />
            <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Automation (coming soon)</p>
            <div className="my-1 border-t border-border" />
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
              Archive this list
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-left text-sm rounded-none"
              onClick={() => {
                onArchiveAllCards();
                setMenuOpen(false);
              }}
            >
              Archive all cards in this list
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start px-4 py-2 text-sm text-danger hover:text-danger rounded-none"
              onClick={() => {
                setMenuOpen(false);
                setSortMenuOpen(false);
                setMoveListMenuOpen(false);
                setMoveCardsMenuOpen(false);
                onDelete();
              }}
            >
              Delete
            </Button>

            {sortMenuOpen && (
              <div className="absolute left-full top-0 ml-1 z-[90] w-64 rounded-md border border-border bg-bg-surface text-base shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-sm font-semibold text-base">Sort list</p>
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

            {moveCardsMenuOpen && (
              <div className="absolute left-full top-0 ml-1 z-[90] w-64 rounded-md border border-border bg-bg-surface text-base shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-sm font-semibold text-base">Move cards to list</p>
                  <Button
                    variant="ghost"
                    className="h-7 w-7 rounded p-0 text-subtle"
                    onClick={() => setMoveCardsMenuOpen(false)}
                    aria-label="Close move cards menu"
                  >
                    ×
                  </Button>
                </div>
                <div className="py-1">
                  {availableLists.filter((entry) => entry.id !== list.id).length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted">No target lists</p>
                  ) : (
                    availableLists.filter((entry) => entry.id !== list.id).map((target) => (
                      <Button
                        key={target.id}
                        variant="ghost"
                        className="w-full justify-start px-3 py-2 text-sm rounded-none"
                        onClick={() => {
                          onMoveAllCards(target.id);
                          setMoveCardsMenuOpen(false);
                          setMenuOpen(false);
                        }}
                      >
                        {target.title}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            )}

            {moveListMenuOpen && (
              <div className="absolute left-full top-0 ml-1 z-[90] w-64 rounded-md border border-border bg-bg-surface text-base shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-sm font-semibold text-base">Move list to position</p>
                  <Button
                    variant="ghost"
                    className="h-7 w-7 rounded p-0 text-subtle"
                    onClick={() => setMoveListMenuOpen(false)}
                    aria-label="Close move list menu"
                  >
                    ×
                  </Button>
                </div>
                <div className="py-1">
                  {availableLists.map((entry, index) => (
                    <Button
                      key={entry.id}
                      variant="ghost"
                      className="w-full justify-start px-3 py-2 text-sm rounded-none"
                      onClick={() => {
                        onMoveList(index);
                        setMoveListMenuOpen(false);
                        setMenuOpen(false);
                      }}
                    >
                      {index + 1}. {entry.title}
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

function areEqual(prev: Props, next: Props): boolean {
  if (prev === next) return true;

  return (
    prev.list.id === next.list.id
    && prev.list.title === next.list.title
    && prev.cardCount === next.cardCount
    && prev.onRename === next.onRename
    && prev.onAddCard === next.onAddCard
    && prev.onCopyList === next.onCopyList
    && prev.onMoveList === next.onMoveList
    && prev.onMoveAllCards === next.onMoveAllCards
    && prev.onArchive === next.onArchive
    && prev.onArchiveAllCards === next.onArchiveAllCards
    && prev.onDelete === next.onDelete
    && prev.onSortBy === next.onSortBy
    && prev.onChangeListColor === next.onChangeListColor
    && prev.listColor === next.listColor
    && prev.textTone === next.textTone
    && prev.availableLists === next.availableLists
    && prev.hasBackground === next.hasBackground
  );
}

export default memo(ListHeader, areEqual);
