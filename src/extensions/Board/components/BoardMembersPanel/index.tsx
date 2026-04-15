// BoardMembersPanel — slide-in panel for managing board members and guests.
// Tabs: Members (list/add/change role/remove), Guests (invite by email/list/revoke).
// Only ADMIN/OWNER board members can edit; others see read-only views.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import {
  membersSelector,
  fetchWorkspaceMembersThunk,
} from '~/extensions/Workspace/containers/WorkspacePage/WorkspacePage.duck';
import { selectCurrentUserWorkspaceRole } from '~/extensions/Workspace/slices/workspaceSlice';
import { selectBoard } from '~/extensions/Board/slices/boardSlice';
import {
  useGetBoardMembersQuery,
  useAddBoardMemberMutation,
  useUpdateBoardMemberMutation,
  useRemoveBoardMemberMutation,
  useJoinBoardMutation,
  type BoardMemberRole,
} from '../../slices/boardMembersSlice';
import MemberRow from './MemberRow';
import AddMemberInput from './AddMemberInput';
import GuestsTab from './GuestsTab';

type Tab = 'members' | 'guests';

interface Props {
  onClose: () => void;
  /** When true, the entire panel is suppressed (workspace GUEST role). */
  isGuest?: boolean;
}

const BoardMembersPanel = ({ onClose, isGuest = false }: Props) => {
  const { boardId } = useParams<{ boardId: string }>();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectAuthUser);
  const board = useAppSelector(selectBoard);
  const workspaceMembers = useAppSelector(membersSelector);
  const workspaceRole = useAppSelector(selectCurrentUserWorkspaceRole);
  const [activeTab, setActiveTab] = useState<Tab>('members');

  // [why] If the user navigates directly to a board URL (bypassing the workspace page),
  // the workspace members slice is empty. Fetch members lazily so the add-member search works.
  useEffect(() => {
    if (board?.workspaceId && workspaceMembers.length === 0) {
      dispatch(fetchWorkspaceMembersThunk({ workspaceId: board.workspaceId }));
    }
  }, [dispatch, board?.workspaceId, workspaceMembers.length]);

  const { data: boardMembers = [], isLoading } = useGetBoardMembersQuery(boardId ?? '', {
    skip: !boardId,
  });
  const [addMember] = useAddBoardMemberMutation();
  const [updateMember] = useUpdateBoardMemberMutation();
  const [removeMember] = useRemoveBoardMemberMutation();
  const [joinBoard, { isLoading: isJoining }] = useJoinBoardMutation();

  // Whether the current user is already an explicit board member.
  const isSelfMember = useMemo(
    () => boardMembers.some((m) => m.user_id === currentUser?.id),
    [boardMembers, currentUser],
  );

  // Show join button when the caller is a workspace member but not yet in board_members.
  // ADMIN/OWNER can join any board (including PRIVATE); MEMBER/VIEWER only open boards.
  const canSelfJoin =
    !isSelfMember &&
    (workspaceRole === 'ADMIN' || workspaceRole === 'OWNER'
      ? true
      : board?.visibility !== 'PRIVATE') &&
    (workspaceRole === 'MEMBER' || workspaceRole === 'VIEWER' || workspaceRole === 'ADMIN' || workspaceRole === 'OWNER');

  // Determine if the current user can manage board members.
  // [why] Workspace OWNER/ADMIN have authority over all boards even if not explicitly
  // added to board_members — the server checks workspace role for all board write ops.
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (workspaceRole === 'OWNER' || workspaceRole === 'ADMIN') return true;
    const self = boardMembers.find((m) => m.user_id === currentUser.id);
    return self?.role === 'ADMIN' || self?.role === 'OWNER';
  }, [boardMembers, currentUser, workspaceRole]);

  // Count admins to enforce last-admin guard.
  const adminCount = useMemo(
    () => boardMembers.filter((m) => m.role === 'ADMIN' || m.role === 'OWNER').length,
    [boardMembers],
  );

  // Workspace members eligible to be added: non-GUEST workspace role, not already on the board.
  const boardMemberIds = useMemo(
    () => new Set(boardMembers.map((m) => m.user_id)),
    [boardMembers],
  );

  const candidates = useMemo(
    () =>
      // [why] 'GUEST' is a runtime value returned by the server but not in the static Role union.
      // Cast to string for the comparison to avoid TypeScript false-positive overlap error.
      workspaceMembers.filter(
        (wm) => (wm.role as string) !== 'GUEST' && !boardMemberIds.has(wm.userId),
      ),
    [workspaceMembers, boardMemberIds],
  );

  // [why] GUEST users have no member-management rights — suppress the panel entirely.
  // Must be after all hooks to satisfy the Rules of Hooks.
  if (isGuest) return null;

  const handleAdd = async (userId: string, role: BoardMemberRole) => {
    if (!boardId) return;
    await addMember({ boardId, userId, role });
  };

  const handleJoin = async () => {
    if (!boardId) return;
    await joinBoard(boardId);
  };

  const handleRoleChange = async (userId: string, role: BoardMemberRole) => {
    if (!boardId) return;
    await updateMember({ boardId, userId, role });
  };

  const handleRemove = async (userId: string) => {
    if (!boardId) return;
    await removeMember({ boardId, userId });
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-30 bg-black/50"
      onClick={onClose}
      aria-label="Close members panel"
    >
      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        className="absolute right-0 top-0 h-full w-80 bg-bg-base border-l border-border flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Board Members"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-sm">Board Members</h2>
          <button
            className="text-muted hover:text-subtle transition-colors"
            onClick={onClose}
            aria-label="Close members panel"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
              activeTab === 'members'
                ? 'text-indigo-400 border-b-2 border-indigo-400 -mb-px'
                : 'text-muted hover:text-subtle'
            }`}
            aria-selected={activeTab === 'members'}
            role="tab"
          >
            Members
          </button>
          {/* Guests tab — only admins can invite guests; all can view */}
          <button
            type="button"
            onClick={() => setActiveTab('guests')}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
              activeTab === 'guests'
                ? 'text-indigo-400 border-b-2 border-indigo-400 -mb-px'
                : 'text-muted hover:text-subtle'
            }`}
            aria-selected={activeTab === 'guests'}
            role="tab"
          >
            Guests
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {activeTab === 'members' ? (
            <>
              {/* Add member input — only admins can add */}
              {isAdmin && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                    Add member
                  </p>
                  <AddMemberInput candidates={candidates} onAdd={handleAdd} />
                </div>
              )}

              {/* Join button — workspace member not yet on this board */}
              {canSelfJoin && (
                <div className="rounded-md border border-border bg-bg-overlay px-4 py-3">
                  <p className="mb-2 text-sm text-muted">
                    You are not a member of this board yet. Join to appear in @mention suggestions.
                  </p>
                  <button
                    type="button"
                    disabled={isJoining}
                    onClick={handleJoin}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-inverse hover:bg-primary-hover disabled:opacity-50"
                  >
                    {isJoining ? 'Joining…' : 'Join this board'}
                  </button>
                </div>
              )}

              {/* Member list */}
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Members
                </p>
                {isLoading ? (
                  <p className="text-sm text-muted">Loading…</p>
                ) : boardMembers.length === 0 ? (
                  <p className="text-sm text-muted">No members yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {boardMembers.map((member) => {
                      // Last-admin guard: disable remove for the last ADMIN/OWNER.
                      const isThisLastAdmin =
                        (member.role === 'ADMIN' || member.role === 'OWNER') && adminCount <= 1;

                      return (
                        <MemberRow
                          key={member.user_id}
                          member={member}
                          isLastAdmin={isThisLastAdmin}
                          canEdit={isAdmin}
                          onRoleChange={handleRoleChange}
                          onRemove={handleRemove}
                        />
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <GuestsTab boardId={boardId ?? ''} isAdmin={isAdmin} />
          )}
        </div>
      </div>
    </div>
  );
};

export default BoardMembersPanel;
