// BoardHeader — sticky top bar with editable title, member avatars, share button and ⋯ menu.
import { useState, useRef } from 'react';
import type { Board } from '../api';
import BoardMemberAvatars from './BoardMemberAvatars';

interface Member {
  id: string;
  display_name: string | null;
  email: string;
}

interface Props {
  board: Board;
  members?: Member[];
  connected?: boolean;
  onTitleSave: (title: string) => Promise<void>;
  onArchive?: () => void;
  onDelete?: () => void;
}

const BoardHeader = ({
  board,
  members = [],
  connected = true,
  onTitleSave,
  onArchive,
  onDelete,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(board.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    <header className="sticky top-0 z-10 flex items-center gap-3 bg-slate-900/80 backdrop-blur-sm px-4 py-2 border-b border-slate-800">
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
          className="bg-slate-800 text-slate-100 font-semibold text-lg rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 max-w-xs"
          aria-label="Edit board title"
        />
      ) : (
        <button
          className="text-slate-100 font-semibold text-lg hover:bg-slate-800 rounded px-2 py-0.5 transition-colors"
          onClick={handleTitleClick}
          aria-label="Click to edit board title"
        >
          {board.title}
        </button>
      )}

      {/* Connection indicator */}
      <span
        className={`h-2 w-2 rounded-full shrink-0 ${connected ? 'bg-green-500' : 'bg-slate-500'}`}
        title={connected ? 'Live' : 'Offline'}
        aria-label={connected ? 'Connected' : 'Disconnected'}
      />

      <div className="ml-auto flex items-center gap-2">
        {/* Member avatars */}
        {members.length > 0 && <BoardMemberAvatars members={members} />}

        {/* Settings menu */}
        <div className="relative">
          <button
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Board settings"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            ···
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 rounded-md border border-slate-700 bg-slate-800 py-1 shadow-xl z-20">
              {onArchive && (
                <button
                  className="block w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700"
                  onClick={() => { setMenuOpen(false); onArchive(); }}
                >
                  {board.state === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
                </button>
              )}
              {onDelete && (
                <button
                  className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700"
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                >
                  Delete board
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default BoardHeader;
