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
import { selectIsGuestInActiveWorkspace } from '../../slices/workspaceSlice';
import MemberList from '../../components/MemberList';
import InviteMemberModal from '../../components/InviteMemberModal';
import Button from '~/common/components/Button';

const WorkspacePage = () => {
  const dispatch = useAppDispatch();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const workspace = useAppSelector(currentWorkspaceSelector);
  const members = useAppSelector(membersSelector);
  const loading = useAppSelector(fetchWorkspaceInProgressSelector);
  const error = useAppSelector(fetchWorkspaceErrorSelector);
  const authUser = useAppSelector(selectAuthUser);
  // [why] Derive guest status from callerRole on the active workspace so no extra
  // API call is required — GUESTs are blocked from the members endpoint server-side.
  const isGuest = useAppSelector(selectIsGuestInActiveWorkspace);

  const [showInviteModal, setShowInviteModal] = useState(false);

  // Load workspace + members whenever the workspaceId param changes
  useEffect(() => {
    if (workspaceId) {
      dispatch(fetchWorkspace({ workspaceId }));
    }
  }, [workspaceId, dispatch]);

  // [why] GUEST users are explicitly blocked from the members page (server returns 403
  // on GET /workspaces/:id/members for GUESTs). Show a clear 403 notice instead of
  // a confusing loading state or error.
  if (isGuest) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-amber-800 dark:text-amber-200">
            Access Restricted
          </h2>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Guest users cannot view workspace members. You have been granted access to specific
            boards only.
          </p>
        </div>
      </div>
    );
  }

  // Determine if the current user can manage members (OWNER or ADMIN)
  const currentMember = members.find((m) => m.userId === authUser?.id);
  const canManageMembers =
    currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';
  // Only OWNER/ADMIN may add members directly (matches remove permission).
  const canInvite = canManageMembers;

  const handleDeleteWorkspace = () => {
    if (workspace && window.confirm(`Delete workspace "${workspace.name}"?`)) {
      dispatch(deleteWorkspaceThunk({ workspaceId: workspace.id }));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-subtle">Loading workspace…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p role="alert" className="text-danger">
          Failed to load workspace. Please try again.
        </p>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="p-6">
        <p className="text-subtle">Workspace not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-base">{workspace.name}</h1>
          <p className="text-sm text-muted mt-1">Workspace Settings</p>
        </div>
        {currentMember?.role === 'OWNER' && (
          <Button
            variant="link"
            onClick={handleDeleteWorkspace}
            className="text-sm text-danger underline-offset-4"
          >
            Delete workspace
          </Button>
        )}
      </div>

      {/* Members section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-base">Members</h2>
          {canInvite && (
            <Button
              variant="primary"
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 text-sm" // [theme-exception] text-white on primary button
            >
              + Invite Member
            </Button>
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

