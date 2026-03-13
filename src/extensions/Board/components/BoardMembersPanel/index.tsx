// BoardMembersPanel — slide-in panel for managing board members and guests.
// Tabs: Members (list/add/change role/remove), Guests (invite by email/list/revoke).
// Only ADMIN/OWNER board members can edit; others see read-only views.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import { membersSelector } from '~/extensions/Workspace/containers/WorkspacePage/WorkspacePage.duck';
import {
  useGetBoardMembersQuery,
  useAddBoardMemberMutation,
  useUpdateBoardMemberMutation,
  useRemoveBoardMemberMutation,
  type BoardMemberRole,
} from '../../slices/boardMembersSlice';
import MemberRow from './MemberRow';
import AddMemberInput from './AddMemberInput';
import GuestsTab from './GuestsTab';

type Tab = 'members' | 'guests';

interface Props {
  onClose: () => void;
}

const BoardMembersPanel = ({ onClose }: Props) => {
  const { boardId } = useParams<{ boardId: string }>();
  const currentUser = useAppSelector(selectAuthUser);
  const workspaceMembers = useAppSelector(membersSelector);
  const [activeTab, setActiveTab] = useState<Tab>('members');

  const { data: boardMembers = [], isLoading } = useGetBoardMembersQuery(boardId ?? '', {
    skip: !boardId,
  });
  const [addMember] = useAddBoardMemberMutation();
  const [updateMember] = useUpdateBoardMemberMutation();
  const [removeMember] = useRemoveBoardMemberMutation();

  // Determine if the current user is a board ADMIN or OWNER.
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const self = boardMembers.find((m) => m.user_id === currentUser.id);
    return self?.role === 'ADMIN' || self?.role === 'OWNER';
  }, [boardMembers, currentUser]);

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

  const handleAdd = async (userId: string, role: BoardMemberRole) => {
    if (!boardId) return;
    await addMember({ boardId, userId, role });
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
        className="absolute right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Board Members"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold text-sm">Board Members</h2>
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors"
            onClick={onClose}
            aria-label="Close members panel"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
              activeTab === 'members'
                ? 'text-indigo-400 border-b-2 border-indigo-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
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
                : 'text-slate-400 hover:text-slate-200'
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
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Add member
                  </p>
                  <AddMemberInput candidates={candidates} onAdd={handleAdd} />
                </div>
              )}

              {/* Member list */}
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Members
                </p>
                {isLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : boardMembers.length === 0 ? (
                  <p className="text-sm text-slate-500">No members yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-800">
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
