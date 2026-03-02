// Modal for inviting a new member to a workspace.
import { useState } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  sendInvite,
  inviteInProgressSelector,
  inviteErrorSelector,
  inviteSuccessSelector,
  clearInviteState,
} from '../containers/WorkspacePage/WorkspacePage.duck';
import type { Role } from '../api';

const ROLES: Role[] = ['ADMIN', 'MEMBER', 'VIEWER'];

interface InviteMemberModalProps {
  workspaceId: string;
  onClose: () => void;
}

const InviteMemberModal = ({ workspaceId, onClose }: InviteMemberModalProps) => {
  const dispatch = useAppDispatch();
  const inProgress = useAppSelector(inviteInProgressSelector);
  const error = useAppSelector(inviteErrorSelector);
  const success = useAppSelector(inviteSuccessSelector);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatch(sendInvite({ workspaceId, email, role })).unwrap();
  };

  const handleClose = () => {
    dispatch(clearInviteState());
    onClose();
  };

  const errorMessage = (() => {
    if (!error) return null;
    if (error.message?.includes('insufficient-role')) {
      return "You don't have permission to invite members.";
    }
    return 'Failed to send invite. Please try again.';
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 id="invite-modal-title" className="mb-4 text-lg font-semibold">
          Invite Member
        </h2>

        {success ? (
          <div className="space-y-4">
            <p className="text-green-700">Invite sent successfully.</p>
            <button
              onClick={handleClose}
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
                {ROLES.map((r) => (
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
                onClick={handleClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inProgress}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {inProgress ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InviteMemberModal;
