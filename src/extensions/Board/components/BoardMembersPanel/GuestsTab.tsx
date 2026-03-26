// GuestsTab — invite and list board guests (GUEST workspace role).
// Only ADMIN/OWNER board members see the invite input; all members can view the list.
import { useState } from 'react';
import {
  useGetBoardGuestsQuery,
  useInviteBoardGuestMutation,
  useRevokeBoardGuestMutation,
  useUpdateBoardGuestMutation,
  type BoardGuest,
} from '../../slices/boardGuestsSlice';
import type { GuestType } from '../../mods/guestPermissions';

interface Props {
  boardId: string;
  isAdmin: boolean;
}

const GuestsTab = ({ boardId, isAdmin }: Props) => {
  const { data: guests = [], isLoading } = useGetBoardGuestsQuery(boardId);
  const [inviteGuest] = useInviteBoardGuestMutation();
  const [revokeGuest] = useRevokeBoardGuestMutation();
  const [updateGuest] = useUpdateBoardGuestMutation();

  const [email, setEmail] = useState('');
  // [why] Default to VIEWER to preserve least-privilege behaviour per sprint-89 spec.
  const [guestType, setGuestType] = useState<GuestType>('VIEWER');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Track which guest row is showing a type-change error
  const [typeChangeError, setTypeChangeError] = useState<{ userId: string; message: string } | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setError(null);
    setSuccess(null);
    setInviting(true);
    try {
      await inviteGuest({ boardId, email: trimmed, guestType }).unwrap();
      setEmail('');
      setGuestType('VIEWER');
      setSuccess(`${trimmed} invited as a ${guestType === 'MEMBER' ? 'Member' : 'Viewer'}.`);
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

  const handleTypeChange = async (guest: BoardGuest, newType: GuestType) => {
    setTypeChangeError(null);
    try {
      await updateGuest({ boardId, userId: guest.id, guestType: newType }).unwrap();
    } catch {
      setTypeChangeError({ userId: guest.id, message: `Failed to change type for ${guest.name ?? guest.email}.` });
    }
  };

  return (
    <div className="space-y-4">
      {/* Invite form — only for admins */}
      {isAdmin && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Invite guest by email
          </p>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); setSuccess(null); }}
              placeholder="guest@example.com"
              disabled={inviting}
              className="flex-1 rounded border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              aria-label="Guest email address"
            />
            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-inverse hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </form>

          {/* Guest type toggle — Viewer (read-only) or Member (full write within board) */}
          <div className="mt-2 flex items-center gap-1" role="group" aria-label="Guest type">
            <span className="mr-1 text-xs text-muted">Role:</span>
            <button
              type="button"
              onClick={() => setGuestType('VIEWER')}
              aria-pressed={guestType === 'VIEWER'}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                guestType === 'VIEWER'
                  ? 'bg-bg-overlay text-base'
                  : 'text-muted hover:bg-bg-overlay hover:text-subtle'
              }`}
            >
              Viewer
            </button>
            <button
              type="button"
              onClick={() => setGuestType('MEMBER')}
              aria-pressed={guestType === 'MEMBER'}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                guestType === 'MEMBER'
                  ? 'bg-indigo-700 text-base'
                  : 'text-muted hover:bg-bg-overlay hover:text-subtle'
              }`}
            >
              Member
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="mt-2 text-xs text-success">
              {success}
            </p>
          )}
        </div>
      )}

      {/* Guest list */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
          Guests
        </p>
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : guests.length === 0 ? (
          <p className="text-sm text-muted">No guests yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {guests.map((guest) => (
              <li key={guest.id} className="flex flex-col gap-1 py-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-base">{guest.name}</p>
                    {guest.name !== guest.email && (
                      <p className="truncate text-xs text-muted">{guest.email}</p>
                    )}
                  </div>
                  <div className="ml-2 flex items-center gap-1 shrink-0">
                    {/* Guest type badge — interactive for admins */}
                    {isAdmin ? (
                      <div role="group" aria-label={`Guest type for ${guest.name ?? guest.email}`} className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => { if (guest.guestType !== 'VIEWER') void handleTypeChange(guest, 'VIEWER'); }}
                          aria-pressed={guest.guestType === 'VIEWER'}
                          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                            guest.guestType === 'VIEWER'
                              ? 'bg-bg-overlay text-base'
                              : 'text-muted hover:bg-bg-overlay hover:text-subtle'
                          }`}
                        >
                          Viewer
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (guest.guestType !== 'MEMBER') void handleTypeChange(guest, 'MEMBER'); }}
                          aria-pressed={guest.guestType === 'MEMBER'}
                          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                            guest.guestType === 'MEMBER'
                              ? 'bg-indigo-700 text-base'
                              : 'text-muted hover:bg-bg-overlay hover:text-subtle'
                          }`}
                        >
                          Member
                        </button>
                      </div>
                    ) : (
                      /* Read-only badge for non-admins */
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        guest.guestType === 'MEMBER'
                          ? 'bg-indigo-900/60 text-indigo-300'
                          : 'bg-bg-overlay text-muted'
                      }`}>
                        {guest.guestType === 'MEMBER' ? 'Member' : 'Viewer'}
                      </span>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(guest)}
                        className="rounded px-2 py-1 text-xs text-muted hover:bg-bg-overlay hover:text-danger transition-colors"
                        aria-label={`Remove guest ${guest.name ?? guest.email}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {/* Per-row error for type change failure */}
                {typeChangeError?.userId === guest.id && (
                  <p role="alert" className="text-xs text-danger">{typeChangeError.message}</p>
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
