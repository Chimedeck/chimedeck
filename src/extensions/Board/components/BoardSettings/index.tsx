// BoardSettings component — slide-in panel for board-level settings.
// Shown to all members, but the VisibilitySelector is gated to ADMIN/OWNER.
// Sprint 79: role-aware UI using boardMembersSlice to determine current user's board role.
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PuzzlePieceIcon } from '@heroicons/react/24/outline';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectBoard } from '../../slices/boardSlice';
import { apiClient } from '~/common/api/client';
import { patchBoardVisibility } from '../../api';
import VisibilitySelector, { type BoardVisibility } from './VisibilitySelector';
import { useGetBoardMembersQuery } from '../../slices/boardMembersSlice';
import BackgroundPicker from '~/extensions/Board/containers/BoardSettings/BackgroundPicker';
import BoardCustomFieldsPanel from '~/extensions/CustomFields/BoardCustomFieldsPanel';

interface Props {
  onClose: () => void;
  /** ID of the current authenticated user; used to check board role. */
  currentUserId?: string;
}

const BoardSettings = ({ onClose, currentUserId }: Props) => {
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();
  const board = useAppSelector(selectBoard);

  const [visibility, setVisibility] = useState<BoardVisibility>(
    (board as { visibility?: BoardVisibility } | null)?.visibility ?? 'WORKSPACE',
  );
  const [saving, setSaving] = useState(false);

  // Sync local state when the board loads or updates.
  useEffect(() => {
    const v = (board as { visibility?: BoardVisibility } | null)?.visibility;
    if (v) setVisibility(v);
  }, [board]);

  // Fetch board members to derive the current user's board role.
  const { data: membersData } = useGetBoardMembersQuery(boardId ?? '', {
    skip: !boardId,
  });

  // Determine if the current user is a board ADMIN or OWNER.
  const isAdmin = (() => {
    if (!currentUserId || !membersData) return false;
    const self = membersData.find((m) => m.user_id === currentUserId);
    return self?.role === 'ADMIN' || self?.role === 'OWNER';
  })();

  const handleVisibilityChange = async (newVisibility: BoardVisibility) => {
    if (!boardId || newVisibility === visibility) return;
    setVisibility(newVisibility);
    setSaving(true);
    try {
      await patchBoardVisibility({ api: apiClient, boardId, visibility: newVisibility });
    } catch {
      // Rollback on failure.
      const prev = (board as { visibility?: BoardVisibility } | null)?.visibility ?? 'WORKSPACE';
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
      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        className="absolute right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Board Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold text-sm">Board Settings</h2>
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors"
            onClick={onClose}
            aria-label="Close settings panel"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Visibility — only admins/owners may change it */}
          {isAdmin && (
            <VisibilitySelector
              value={visibility}
              onChange={handleVisibilityChange}
              disabled={saving}
            />
          )}

          <div className={isAdmin ? 'border-t border-slate-700 pt-4' : undefined}>
            <BackgroundPicker boardId={boardId ?? ''} />
          </div>

          <div className="border-t border-slate-700 pt-4">
            <BoardCustomFieldsPanel />
          </div>

          <div className="border-t border-slate-700 pt-4">
            <button
              onClick={handlePluginsClick}
              className="w-full text-left px-3 py-2 rounded text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors"
            >
              <PuzzlePieceIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Plugins</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardSettings;
