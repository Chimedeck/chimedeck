// GuestsTab — invite and list board guests (GUEST workspace role).
// Only ADMIN/OWNER board members see the invite input; all members can view the list.
import { useState } from 'react';
import {
  useGetBoardGuestsQuery,
  useInviteBoardGuestMutation,
  useRevokeBoardGuestMutation,
  type BoardGuest,
} from '../../slices/boardGuestsSlice';

interface Props {
  boardId: string;
  isAdmin: boolean;
}

const GuestsTab = ({ boardId, isAdmin }: Props) => {
  const { data: guests = [], isLoading } = useGetBoardGuestsQuery(boardId);
  const [inviteGuest] = useInviteBoardGuestMutation();
  const [revokeGuest] = useRevokeBoardGuestMutation();

  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setError(null);
    setSuccess(null);
    setInviting(true);
    try {
      await inviteGuest({ boardId, email: trimmed }).unwrap();
      setEmail('');
      setSuccess(`${trimmed} invited as a guest.`);
    } catch (err: unknown) {
      const apiErr = err as { data?: { name?: string; data?: { message?: string } } };
      const name = apiErr?.data?.name ?? '';
      if (name === 'user-already-workspace-member') {
        setError('This user is already a workspace member and cannot be invited as a guest.');
      } else if (name === 'already-invited') {
        setError('This user is already a guest on this board.');
      } else {
        setError(apiErr?.data?.data?.message ?? 'Failed to invite guest.');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (guest: BoardGuest) => {
    setError(null);
    setSuccess(null);
    try {
      await revokeGuest({ boardId, userId: guest.id }).unwrap();
    } catch {
      setError(`Failed to remove ${guest.name ?? guest.email}.`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Invite form — only for admins */}
      {isAdmin && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Invite guest by email
          </p>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); setSuccess(null); }}
              placeholder="guest@example.com"
              disabled={inviting}
              className="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              aria-label="Guest email address"
            />
            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="mt-2 text-xs text-green-400">
              {success}
            </p>
          )}
        </div>
      )}

      {/* Guest list */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Guests
        </p>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : guests.length === 0 ? (
          <p className="text-sm text-slate-500">No guests yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {guests.map((guest) => (
              <li key={guest.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{guest.name}</p>
                  {guest.name !== guest.email && (
                    <p className="truncate text-xs text-slate-400">{guest.email}</p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(guest)}
                    className="ml-2 shrink-0 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-red-400 transition-colors"
                    aria-label={`Remove guest ${guest.name ?? guest.email}`}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GuestsTab;
