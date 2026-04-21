// BoardHeader — sticky top bar with editable title, member avatars, share button and ⋯ menu.
import { useState, useRef, useEffect } from 'react';
import type { Board } from '../api';
import MemberAvatarStack from './MemberAvatarStack';
import ConnectionBadge from '~/common/components/ConnectionBadge';
import type { ConnectionState } from '~/common/components/ConnectionBadge';
import PollingIndicator from '~/extensions/Realtime/PollingIndicator';
import AutomationHeaderButton from '~/extensions/Automation/components/AutomationHeaderButton';
import BoardButtonsBar from '~/extensions/Automation/components/BoardButtons/BoardButtonsBar';

interface Member {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url?: string | null;
}

interface Props {
  board: Board;
  members?: Member[];
  /** Three-state connection indicator; defaults to 'connected' for backward compat */
  connectionState?: ConnectionState;
  /** When true, show HTTP polling fallback indicator next to connection badge */
  pollingActive?: boolean;
  /** @deprecated use connectionState instead */
  connected?: boolean;
  onTitleSave: (title: string) => Promise<void>;
  onArchive?: () => void;
  onDelete?: () => void;
  onOpenSettings?: () => void;
  onOpenAutomation?: () => void;
  onOpenMembers?: () => void;
  activeAutomationCount?: number;
  /** When true the header sits over a board background image — apply frosted-glass styling. */
  hasBackground?: boolean;
  /** When true, a parent container supplies the glass backdrop — header itself stays transparent. */
  useParentGlass?: boolean;
  /** When true, hides member avatar stack and board settings menu (GUEST workspace role). */
  isGuest?: boolean;
  /** Called when user stars the board */
  onStar?: () => void;
  /** Called when user unstars the board */
  onUnstar?: () => void;
}

const BoardHeader = ({
  board,
  members = [],
  connectionState,
  pollingActive = false,
  connected = true,
  onTitleSave,
  onArchive,
  onDelete,
  onOpenSettings,
  onOpenAutomation,
  onOpenMembers,
  activeAutomationCount = 0,
  hasBackground = false,
  useParentGlass = false,
  isGuest = false,
  onStar,
  onUnstar,
}: Props) => {
  // Resolve connection state: prefer explicit connectionState, fall back to legacy connected bool
  const resolvedState: ConnectionState =
    connectionState ?? (connected ? 'connected' : 'reconnecting');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(board.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close the settings menu when user clicks outside it
  useEffect(() => {
    if (!menuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [menuOpen]);

  const handleTitleClick = () => {
    setTitle(board.title);
    setEditing(true);
    // Auto-focus after state update
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleTitleSave = async () => {
    const trimmed = title.trim();
    setEditing(false);
    if (!trimmed || trimmed === board.title) {
      setTitle(board.title);
      return;
    }
    try {
      await onTitleSave(trimmed);
    } catch {
      setTitle(board.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleTitleSave();
    if (e.key === 'Escape') {
      setTitle(board.title);
      setEditing(false);
    }
  };

  let headerBgClass: string;  if (useParentGlass) {
    // Parent owns the surface — header is fully transparent, no border
    headerBgClass = '';
  } else if (hasBackground) {
    headerBgClass = ' [backdrop-filter:blur(20px)] border-b border-[#eee]';
  } else {
    headerBgClass = '';
  }

  let starBtnClass: string;
  if (board.isStarred) {
    starBtnClass = 'shrink-0 rounded p-1 transition-colors text-yellow-400 hover:text-yellow-300';
  } else if (hasBackground) {
    starBtnClass = 'shrink-0 rounded p-1 transition-colors text-white/60 hover:text-yellow-300';
  } else {
    starBtnClass = 'shrink-0 rounded p-1 transition-colors text-muted hover:text-yellow-400';
  }

  return (
    <header className={`sticky top-0 z-30 flex items-center gap-3 px-6 pt-4 pb-2${headerBgClass}`}>
      {/* Editable board title */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={handleKeyDown}
          className={`bg-bg-overlay font-semibold text-lg rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary min-w-0 max-w-xs${hasBackground ? ' text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]' : ' text-base'}`}
          aria-label="Edit board title"
        />
      ) : (
        <button
          className={`text-[17px] font-semibold rounded px-2 py-0.5 transition-colors${hasBackground ? ' text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)] hover:bg-white/20' : ' text-base hover:bg-bg-overlay'}`}
          onClick={handleTitleClick}
          aria-label="Click to edit board title"
        >
          {board.title}
        </button>
      )}

      {/* Favourite star button — visible next to the board title */}
      {(onStar != null || onUnstar != null) && (
        <button
          type="button"
          onClick={() => { board.isStarred ? onUnstar?.() : onStar?.(); }}
          aria-label={board.isStarred ? 'Remove from favourites' : 'Add to favourites'}
          className={starBtnClass}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={board.isStarred ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        </button>
      )}

      {/* Connection badge (sprint-20) */}
      <ConnectionBadge state={resolvedState} />
      <PollingIndicator active={pollingActive} />

      <div className="ml-auto flex items-center gap-2">
        {/* Member avatar stack + Share button — hidden for workspace GUESTs */}
        {!isGuest && (
          <>
            <MemberAvatarStack
              members={members}
              onOpenMembers={onOpenMembers ?? (() => {})}
            />
            <button
              type="button"
              onClick={onOpenMembers}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-inverse transition-colors"
              aria-label="Share board — invite members"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .793l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.475l6.733-3.367A2.52 2.52 0 0 1 13 4.5z" />
              </svg>
              Share
            </button>
          </>
        )}

        {/* Action buttons — frosted glass pill when a background image is present so
            icons don't blend into the background noise (glassmorphism). */}
        <div className={hasBackground
          ? 'flex items-center gap-0.5 rounded-lg px-1.5 py-1 bg-white/15 backdrop-blur-md border border-white/20 shadow-sm'
          : 'flex items-center gap-0.5'
        }>
          {/* Board buttons bar — left of automation header button */}
          {onOpenAutomation && <BoardButtonsBar boardId={board.id} hasBackground={hasBackground} />}

          {/* Automation button — left of the ··· settings menu */}
          {onOpenAutomation && (
            <AutomationHeaderButton
              activeCount={activeAutomationCount}
              onClick={onOpenAutomation}
              hasBackground={hasBackground}
            />
          )}

          {/* Settings menu — visible for all users; destructive actions gated below */}
          <div className="relative" ref={menuContainerRef}>
            <button
              className={`rounded p-1.5 transition-colors${hasBackground ? ' text-white/90 hover:bg-white/20 hover:text-white' : ' text-muted hover:bg-bg-surface hover:text-subtle'}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Board settings"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              ···
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-md border border-border bg-bg-surface py-1 shadow-xl z-50">
                {onOpenSettings && (
                  <button
                    className="block w-full px-4 py-2 text-left text-sm text-subtle hover:bg-bg-overlay"
                    onClick={() => { setMenuOpen(false); onOpenSettings(); }}
                  >
                    Board settings
                  </button>
                )}
                {onArchive && (
                  <button
                    className="block w-full px-4 py-2 text-left text-sm text-subtle hover:bg-bg-overlay"
                    onClick={() => { setMenuOpen(false); onArchive(); }}
                  >
                    {board.state === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
                  </button>
                )}
                {onDelete && (
                  <button
                    className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-bg-overlay"
                    onClick={() => { setMenuOpen(false); onDelete(); }}
                  >
                    Delete board
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default BoardHeader;
