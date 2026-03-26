// BoardSettings — slide-in panel for board-level settings.
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PuzzlePieceIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectBoard } from '../../slices/boardSlice';
import { apiClient } from '~/common/api/client';
import { patchBoardVisibility } from '../../api';
import VisibilitySelector, { type BoardVisibility } from './VisibilitySelector';
import BoardCustomFieldsPanel from '~/extensions/CustomFields/BoardCustomFieldsPanel';
import BackgroundPicker from './BackgroundPicker';
import BoardNotificationToggle from './BoardNotificationToggle';
import BoardNotificationTypePreferences from './BoardNotificationTypePreferences';

interface Props {
  onClose: () => void;
  /** When true, the entire panel is suppressed (workspace GUEST role). */
  isGuest?: boolean;
}

const BoardSettings = ({ onClose, isGuest = false }: Props) => {
  // [why] GUEST users must not access board settings — return nothing to prevent render.
  if (isGuest) return null;
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();
  const board = useAppSelector(selectBoard);

  // Local state mirrors board.visibility; initialised once board is loaded.
  const [visibility, setVisibility] = useState<BoardVisibility>(
    (board as { visibility?: BoardVisibility } | null)?.visibility ?? 'PRIVATE',
  );
  const [saving, setSaving] = useState(false);

  // Sync local state when the board is loaded (e.g. after initial fetch).
  useEffect(() => {
    const v = (board as { visibility?: BoardVisibility } | null)?.visibility;
    if (v) setVisibility(v);
  }, [board]);

  const handleVisibilityChange = async (newVisibility: BoardVisibility) => {
    if (!boardId || newVisibility === visibility) return;
    setVisibility(newVisibility); // optimistic update
    setSaving(true);
    try {
      await patchBoardVisibility({ api: apiClient, boardId, visibility: newVisibility });
    } catch {
      // Rollback on failure.
      const prev = (board as { visibility?: BoardVisibility } | null)?.visibility ?? 'PRIVATE';
      setVisibility(prev);
    } finally {
      setSaving(false);
    }
  };

  const handlePluginsClick = () => {
    onClose();
    navigate(`/boards/${boardId}/settings/plugins`);
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-30 bg-black/50"
      onClick={onClose}
      aria-label="Close settings"
    >
      {/* Panel — stop click propagation so clicks inside don't close */}
      <div
        className="absolute right-0 top-0 h-full w-80 bg-bg-base border-l border-border flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Board Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-sm">Board Settings</h2>
          <button
            className="text-muted hover:text-subtle transition-colors"
            onClick={onClose}
            aria-label="Close settings panel"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Visibility */}
          <VisibilitySelector
            value={visibility}
            onChange={handleVisibilityChange}
            disabled={saving}
          />

          <div className="border-t border-border pt-4">
            <BackgroundPicker boardId={boardId ?? ''} />
          </div>

          <div className="border-t border-border pt-4">
            <BoardCustomFieldsPanel />
          </div>

          <div className="border-t border-border pt-4">
            <button
              onClick={handlePluginsClick}
              className="w-full text-left px-3 py-2 rounded text-sm text-subtle hover:bg-bg-surface flex items-center gap-2 transition-colors"
            >
              <PuzzlePieceIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Plugins</span>
            </button>
          </div>

          {/* User settings — per-board preferences for the current user */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCircleIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                User settings
              </h3>
            </div>
            {boardId && (
              <>
                <BoardNotificationToggle boardId={boardId} />
                <div className="mt-4">
                  <BoardNotificationTypePreferences boardId={boardId} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardSettings;
