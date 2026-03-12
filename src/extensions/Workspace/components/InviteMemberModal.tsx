// Modal for adding a member directly to a workspace (by email, user must already have an account).
import { useState } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import {
  addMemberThunk,
  fetchWorkspace,
} from '../containers/WorkspacePage/WorkspacePage.duck';
import type { Role } from '../api';

// All assignable roles ordered from most to least privileged.
const ALL_ROLES: Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
const ROLE_RANK: Record<Role, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1, GUEST: 0 };

interface InviteMemberModalProps {
  workspaceId: string;
  // Caller's own role — available roles are capped to this rank.
  callerRole: Role;
  onClose: () => void;
}

const InviteMemberModal = ({ workspaceId, callerRole, onClose }: InviteMemberModalProps) => {
  // Only offer roles the caller is allowed to assign (≤ their own rank).
  const assignableRoles = ALL_ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[callerRole]);
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState('');
  // Default to MEMBER if assignable, otherwise the highest assignable role.
  const defaultRole: Role = assignableRoles.includes('MEMBER') ? 'MEMBER' : (assignableRoles[0] ?? 'VIEWER');
  const [role, setRole] = useState<Role>(defaultRole);
  const [inProgress, setInProgress] = useState(false);
  const [success, setSuccess] = useState(false);
  const [addedEmail, setAddedEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInProgress(true);
    try {
      await dispatch(addMemberThunk({ workspaceId, email: email.trim(), role })).unwrap();
      setAddedEmail(email.trim());
      setSuccess(true);
      // Refresh members list
      dispatch(fetchWorkspace({ workspaceId }));
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '';
      if (msg.includes('user-not-found')) {
        setErrorMessage(`No account found for ${email}. Ask them to sign up first.`);
      } else if (msg.includes('already-a-member')) {
        setErrorMessage(`${email} is already a member of this workspace.`);
      } else if (msg.includes('insufficient-role')) {
        setErrorMessage("You don't have permission to add members.");
      } else {
        setErrorMessage('Failed to add member. Please try again.');
      }
    } finally {
      setInProgress(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 id="invite-modal-title" className="mb-4 text-lg font-semibold">
          Add Member
        </h2>

        {success ? (
          <div className="space-y-4">
            <p className="text-green-700">
              ✓ <strong>{addedEmail}</strong> has been added to the workspace.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="invite-email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                The user must already have an account.
              </p>
            </div>

            <div>
              <label
                htmlFor="invite-role"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            {errorMessage && (
              <p role="alert" className="text-sm text-red-600">
                {errorMessage}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inProgress}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {inProgress ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InviteMemberModal;

