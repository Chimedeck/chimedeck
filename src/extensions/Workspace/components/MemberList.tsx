// Displays the list of workspace members with role management and removal actions.
import { useState } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  updateMemberRoleThunk,
  removeMemberThunk,
  removeErrorSelector,
  updateRoleErrorSelector,
} from '../containers/WorkspacePage/WorkspacePage.duck';
import type { WorkspaceMember, Role } from '../api';
import RoleBadge from './RoleBadge';
import Button from '../../../common/components/Button';

const ASSIGNABLE_ROLES: Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

interface MemberListProps {
  workspaceId: string;
  members: WorkspaceMember[];
  // userId of the currently authenticated user, used to prevent self-removal.
  currentUserId: string;
  canManageMembers: boolean;
}

const MemberList = ({
  workspaceId,
  members,
  currentUserId,
  canManageMembers,
}: MemberListProps) => {
  const dispatch = useAppDispatch();
  const removeError = useAppSelector(removeErrorSelector);
  const updateRoleError = useAppSelector(updateRoleErrorSelector);

  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);

  const ownerCount = members.filter((m) => m.role === 'OWNER').length;

  const handleRoleChange = (userId: string, newRole: Role) => {
    dispatch(updateMemberRoleThunk({ workspaceId, userId, role: newRole }));
  };

  const handleRemoveConfirm = (userId: string) => {
    setConfirmRemoveUserId(userId);
  };

  const handleRemove = () => {
    if (confirmRemoveUserId) {
      dispatch(removeMemberThunk({ workspaceId, userId: confirmRemoveUserId }));
      setConfirmRemoveUserId(null);
    }
  };

  const isLastOwner = (member: WorkspaceMember) =>
    member.role === 'OWNER' && ownerCount <= 1;

  const removeErrorMessage = (() => {
    if (!removeError) return null;
    if (removeError.message?.includes('workspace-must-have-owner')) {
      return 'Cannot remove the last owner of the workspace.';
    }
    if (removeError.message?.includes('insufficient-role')) {
      return "You don't have permission to manage members.";
    }
    return 'Action failed. Please try again.';
  })();

  if (members.length === 0) {
    return <p className="text-sm text-muted">No members found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      {(removeErrorMessage || updateRoleError) && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {removeErrorMessage ?? 'Role update failed. Please try again.'}
        </p>
      )}

      <table className="min-w-full divide-y divide-border text-sm">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left font-medium text-muted">Email</th>
            <th className="px-4 py-2 text-left font-medium text-muted">Role</th>
            {canManageMembers && (
              <th className="px-4 py-2 text-left font-medium text-muted">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((member) => (
            <tr key={member.userId}>
              <td className="px-4 py-2 text-base">{member.email}</td>
              <td className="px-4 py-2">
                {canManageMembers && member.userId !== currentUserId ? (
                  <select
                    value={member.role}
                    onChange={(e) =>
                      handleRoleChange(member.userId, e.target.value as Role)
                    }
                    aria-label={`Change role for ${member.email}`}
                    className="rounded border border-border bg-bg-overlay text-base px-2 py-0.5 text-xs"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <RoleBadge role={member.role} />
                )}
              </td>
              {canManageMembers && (
                <td className="px-4 py-2">
                  {/* Prevent removing yourself or the last owner */}
                  {member.userId !== currentUserId && !isLastOwner(member) && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleRemoveConfirm(member.userId)}
                      aria-label={`Remove ${member.email}`}
                      className="!text-danger"
                    >
                      Remove
                    </Button>
                  )}
                  {isLastOwner(member) && (
                    <span className="text-xs text-muted">Last owner</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Remove confirmation dialog */}
      {confirmRemoveUserId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-remove-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="rounded-lg bg-bg-surface p-6 shadow-xl">
            <h3 id="confirm-remove-title" className="mb-2 font-semibold">
              Remove member?
            </h3>
            <p className="mb-4 text-sm text-muted">
              Are you sure you want to remove this member from the workspace?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmRemoveUserId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleRemove}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberList;
