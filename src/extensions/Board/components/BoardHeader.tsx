// BoardHeader — sticky top bar with editable title, member avatars, share button and ⋯ menu.
import { useState, useRef, useEffect } from 'react';
import type { Board } from '../api';
import MemberAvatarStack from './MemberAvatarStack';
import ConnectionBadge from '~/common/components/ConnectionBadge';
import type { ConnectionState } from '~/common/components/ConnectionBadge';
import PollingIndicator from '~/extensions/Realtime/PollingIndicator';
import AutomationHeaderButton from '~/extensions/Automation/components/AutomationHeaderButton';
import BoardButtonsBar from '~/extensions/Automation/components/BoardButtons/BoardButtonsBar';
import BoardSearchBar from './BoardSearchBar';
import type { BoardSearchResult } from '~/extensions/Search/api';

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
  /** When true, hides member avatar stack and board settings menu (GUEST workspace role). */
  isGuest?: boolean;
  /** Auth token for board-scoped search requests */
  searchToken?: string;
  /** Initial query to pre-fill (restored from URL) */
  initialSearchQuery?: string;
  /** Called when the user selects a result from the board search bar */
  onSearchResultSelect?: (result: BoardSearchResult) => void;
  /** Called when the active search query changes (for URL sync) */
  onSearchQueryChange?: (query: string) => void;
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
  isGuest = false,
  searchToken,
  initialSearchQuery,
  onSearchResultSelect,
  onSearchQueryChange,
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

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 bg-bg-base/80 backdrop-blur-sm px-4 py-2 border-b border-border">
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
          className="bg-bg-overlay text-base font-semibold text-lg rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary min-w-0 max-w-xs"
          aria-label="Edit board title"
        />
      ) : (
        <button
          className="text-base font-semibold text-lg hover:bg-bg-surface rounded px-2 py-0.5 transition-colors"
          onClick={handleTitleClick}
          aria-label="Click to edit board title"
        >
          {board.title}
        </button>
      )}

      {/* Connection badge (sprint-20) */}
      <ConnectionBadge state={resolvedState} />
      <PollingIndicator active={pollingActive} />

      {/* Board-scoped search — renders when a valid auth token is available */}
      {searchToken && (
        <BoardSearchBar
          boardId={board.id}
          token={searchToken}
          {...(initialSearchQuery ? { initialQuery: initialSearchQuery } : {})}
          {...(onSearchQueryChange ? { onQueryChange: onSearchQueryChange } : {})}
          {...(onSearchResultSelect ? { onSelectResult: onSearchResultSelect } : {})}
        />
      )}

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

        {/* Board buttons bar — left of automation header button */}
        {onOpenAutomation && <BoardButtonsBar boardId={board.id} />}

        {/* Automation button — left of the ··· settings menu */}
        {onOpenAutomation && (
          <AutomationHeaderButton
            activeCount={activeAutomationCount}
            onClick={onOpenAutomation}
          />
        )}

        {/* Settings menu — hidden for workspace GUESTs */}
        {!isGuest && (
        <div className="relative" ref={menuContainerRef}>
          <button
            className="rounded p-1.5 text-muted hover:bg-bg-surface hover:text-subtle transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Board settings"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            ···
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-md border border-border bg-bg-surface py-1 shadow-xl z-20">
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
        )}
      </div>
    </header>
  );
};

export default BoardHeader;
