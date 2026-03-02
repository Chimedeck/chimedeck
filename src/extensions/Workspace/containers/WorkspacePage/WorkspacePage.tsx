// Main workspace management page: shows workspace details, member list, and invite controls.
import { useState } from 'react';
import Page from '~/components/Page';
import FooterContainer from '~/containers/FooterContainer/FooterContainer';
import TopbarContainer from '~/containers/TopbarContainer/TopbarContainer';
import LayoutSingleColumn from '~/layout/LayoutSingleColumn';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import {
  currentWorkspaceSelector,
  membersSelector,
  fetchWorkspaceInProgressSelector,
  fetchWorkspaceErrorSelector,
  deleteWorkspaceThunk,
} from './WorkspacePage.duck';
import WorkspaceSwitcher from '../../components/WorkspaceSwitcher';
import MemberList from '../../components/MemberList';
import InviteMemberModal from '../../components/InviteMemberModal';

// TODO: replace with real current-user selector once auth duck is wired in.
const PLACEHOLDER_CURRENT_USER_ID = '';

const WorkspacePage = () => {
  const dispatch = useAppDispatch();
  const workspace = useAppSelector(currentWorkspaceSelector);
  const members = useAppSelector(membersSelector);
  const loading = useAppSelector(fetchWorkspaceInProgressSelector);
  const error = useAppSelector(fetchWorkspaceErrorSelector);

  const [showInviteModal, setShowInviteModal] = useState(false);

  // Derive whether the current user can manage members (OWNER or ADMIN).
  const currentMember = members.find(
    (m) => m.userId === PLACEHOLDER_CURRENT_USER_ID
  );
  const canManageMembers =
    currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';

  const handleDeleteWorkspace = () => {
    if (workspace && window.confirm(`Delete workspace "${workspace.name}"?`)) {
      dispatch(deleteWorkspaceThunk({ workspaceId: workspace.id }));
    }
  };

  const pageContent = (() => {
    if (loading) {
      return <p className="text-gray-500">Loading workspace…</p>;
    }
    if (error) {
      return (
        <p role="alert" className="text-red-600">
          Something went wrong. Please try again.
        </p>
      );
    }
    if (!workspace) {
      return (
        <p className="text-gray-400">
          Select a workspace above to get started.
        </p>
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{workspace.name}</h1>
          {currentMember?.role === 'OWNER' && (
            <button
              onClick={handleDeleteWorkspace}
              className="text-sm text-red-600 hover:underline"
            >
              Delete workspace
            </button>
          )}
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Members</h2>
            {canManageMembers && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                Invite Member
              </button>
            )}
          </div>
          <MemberList
            workspaceId={workspace.id}
            members={members}
            currentUserId={PLACEHOLDER_CURRENT_USER_ID}
            canManageMembers={canManageMembers}
          />
        </section>
      </div>
    );
  })();

  return (
    <Page title="Workspace Settings">
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
        contentClassName="space-y-6 p-6"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-800">Workspace</h1>
          <WorkspaceSwitcher />
        </div>
        {pageContent}
      </LayoutSingleColumn>

      {showInviteModal && workspace && (
        <InviteMemberModal
          workspaceId={workspace.id}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </Page>
  );
};

export default WorkspacePage;
