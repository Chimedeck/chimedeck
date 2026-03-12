// Main workspace management page: shows workspace details, member list, and invite controls.
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import {
  currentWorkspaceSelector,
  membersSelector,
  fetchWorkspaceInProgressSelector,
  fetchWorkspaceErrorSelector,
  fetchWorkspace,
  deleteWorkspaceThunk,
} from './WorkspacePage.duck';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import MemberList from '../../components/MemberList';
import InviteMemberModal from '../../components/InviteMemberModal';

const WorkspacePage = () => {
  const dispatch = useAppDispatch();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const workspace = useAppSelector(currentWorkspaceSelector);
  const members = useAppSelector(membersSelector);
  const loading = useAppSelector(fetchWorkspaceInProgressSelector);
  const error = useAppSelector(fetchWorkspaceErrorSelector);
  const authUser = useAppSelector(selectAuthUser);

  const [showInviteModal, setShowInviteModal] = useState(false);

  // Load workspace + members whenever the workspaceId param changes
  useEffect(() => {
    if (workspaceId) {
      dispatch(fetchWorkspace({ workspaceId }));
    }
  }, [workspaceId, dispatch]);

  // Determine if the current user can manage members (OWNER or ADMIN)
  const currentMember = members.find((m) => m.userId === authUser?.id);
  const canManageMembers =
    currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';
  // MEMBERs can also invite, but the role options they see are capped to their own rank.
  const canInvite = canManageMembers || currentMember?.role === 'MEMBER';

  const handleDeleteWorkspace = () => {
    if (workspace && window.confirm(`Delete workspace "${workspace.name}"?`)) {
      dispatch(deleteWorkspaceThunk({ workspaceId: workspace.id }));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Loading workspace…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p role="alert" className="text-red-500">
          Failed to load workspace. Please try again.
        </p>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Workspace not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{workspace.name}</h1>
          <p className="text-sm text-gray-400 mt-1">Workspace Settings</p>
        </div>
        {currentMember?.role === 'OWNER' && (
          <button
            onClick={handleDeleteWorkspace}
            className="text-sm text-red-500 hover:text-red-700 hover:underline"
          >
            Delete workspace
          </button>
        )}
      </div>

      {/* Members section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Members</h2>
          {canInvite && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              + Invite Member
            </button>
          )}
        </div>
        <MemberList
          workspaceId={workspace.id}
          members={members}
          currentUserId={authUser?.id ?? ''}
          canManageMembers={canManageMembers}
        />
      </section>

      {showInviteModal && (
        <InviteMemberModal
          workspaceId={workspace.id}
          callerRole={currentMember?.role ?? 'MEMBER'}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
};

export default WorkspacePage;

