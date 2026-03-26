// CardModalBottomBar — sticky bottom action bar for the card detail modal.
// Left: Power-ups popover, Automations popover, Actions dropdown.
// Right: Activity toggle button that shows/hides the activity panel.
import { useEffect, useRef, useState } from 'react';
import {
  ArchiveBoxIcon,
  ArchiveBoxXMarkIcon,
  BoltIcon,
  ChevronUpIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  PuzzlePieceIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Bars3Icon } from '@heroicons/react/24/solid';
import CardPluginButtons from '../../Plugins/uiInjections/CardPluginButtons';
import CardButtonsSection from '../../Automation/components/CardButtons/CardButtonsSection';

interface Props {
  boardId: string;
  cardId: string;
  listId: string;
  cardTitle?: string;
  listTitle?: string;
  boardTitle?: string;
  cardAmount?: string | null;
  cardCurrency?: string | null;
  archived: boolean;
  disabled?: boolean;
  activityVisible: boolean;
  onToggleActivity: () => void;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onCopyLink: () => void;
  onCopyCard: () => void;
}

// ------------------------------------------------------------------
// Utility hook: close popover on outside click and Escape key
// ------------------------------------------------------------------
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  return { open, setOpen, ref };
}

// ------------------------------------------------------------------
// Shared bar-button style
// ------------------------------------------------------------------
const barButtonClass =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted hover:bg-bg-overlay hover:text-base transition-colors disabled:opacity-40 disabled:pointer-events-none';

const CardModalBottomBar = ({
  boardId,
  cardId,
  listId,
  cardTitle,
  listTitle,
  boardTitle,
  cardAmount,
  cardCurrency,
  archived,
  disabled,
  activityVisible,
  onToggleActivity,
  onArchive,
  onDelete,
  onCopyLink,
  onCopyCard,
}: Props) => {
  const powerUps = usePopover();
  const automations = usePopover();
  const actions = usePopover();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-bg-surface/50 rounded-b-2xl flex-shrink-0">
      {/* Left side */}
      <div className="flex items-center gap-1">
        {/* Power-ups popover */}
        <div className="relative" ref={powerUps.ref}>
          <button
            type="button"
            className={barButtonClass}
            aria-expanded={powerUps.open}
            aria-haspopup="true"
            onClick={() => powerUps.setOpen((v) => !v)}
          >
            <PuzzlePieceIcon className="w-4 h-4" />
            Power-ups
            <ChevronUpIcon className={`w-3 h-3 transition-transform ${powerUps.open ? '' : 'rotate-180'}`} />
          </button>
          {powerUps.open && (
            <div className="absolute bottom-full left-0 mb-1 z-10 w-56 rounded-xl bg-bg-surface border border-border shadow-lg p-2">
              <CardPluginButtons
                cardId={cardId}
                listId={listId}
                {...(cardTitle !== undefined ? { cardTitle } : {})}
                {...(listTitle !== undefined ? { listTitle } : {})}
                {...(boardTitle !== undefined ? { boardTitle } : {})}
                {...(cardAmount !== undefined ? { cardAmount } : {})}
                {...(cardCurrency !== undefined ? { cardCurrency } : {})}
                variant="sidebar"
              />
            </div>
          )}
        </div>

        {/* Automations popover */}
        <div className="relative" ref={automations.ref}>
          <button
            type="button"
            className={barButtonClass}
            aria-expanded={automations.open}
            aria-haspopup="true"
            disabled={disabled}
            onClick={() => automations.setOpen((v) => !v)}
          >
            <BoltIcon className="w-4 h-4" />
            Automations
            <ChevronUpIcon className={`w-3 h-3 transition-transform ${automations.open ? '' : 'rotate-180'}`} />
          </button>
          {automations.open && (
            <div className="absolute bottom-full left-0 mb-1 z-10 w-72 rounded-xl bg-bg-surface border border-border shadow-lg p-3">
              <CardButtonsSection boardId={boardId} cardId={cardId} {...(disabled !== undefined ? { disabled } : {})} />
            </div>
          )}
        </div>

        {/* Actions dropdown */}
        <div className="relative" ref={actions.ref}>
          <button
            type="button"
            className={barButtonClass}
            aria-expanded={actions.open}
            aria-haspopup="true"
            onClick={() => actions.setOpen((v) => !v)}
          >
            Actions
            <ChevronUpIcon className={`w-3 h-3 transition-transform ${actions.open ? '' : 'rotate-180'}`} />
          </button>
          {actions.open && (
            <div className="absolute bottom-full left-0 mb-1 z-10 w-52 rounded-xl bg-bg-surface border border-border shadow-lg p-2">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-base hover:bg-bg-overlay rounded-lg transition-colors"
                onClick={() => { actions.setOpen(false); onArchive(); }}
              >
                {archived
                  ? <><ArchiveBoxXMarkIcon className="w-4 h-4 shrink-0" /> Unarchive card</>
                  : <><ArchiveBoxIcon className="w-4 h-4 shrink-0" /> Archive card</>}
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-base hover:bg-bg-overlay rounded-lg transition-colors"
                onClick={() => { actions.setOpen(false); onCopyLink(); }}
              >
                <LinkIcon className="w-4 h-4 shrink-0" /> Copy link
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-base hover:bg-bg-overlay rounded-lg transition-colors"
                onClick={() => { actions.setOpen(false); onCopyCard(); }}
              >
                <DocumentDuplicateIcon className="w-4 h-4 shrink-0" /> Copy card
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-40"
                onClick={() => {
                  actions.setOpen(false);
                  if (confirm('Delete this card? This cannot be undone.')) onDelete();
                }}
                disabled={disabled}
              >
                <TrashIcon className="w-4 h-4 shrink-0" /> Delete card
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right side — activity toggle */}
      <button
        type="button"
        className={`${barButtonClass} ${activityVisible ? 'bg-bg-overlay text-base' : ''}`}
        aria-pressed={activityVisible}
        onClick={onToggleActivity}
      >
        <Bars3Icon className="w-4 h-4" />
        Activity
      </button>
    </div>
  );
};

export default CardModalBottomBar;
