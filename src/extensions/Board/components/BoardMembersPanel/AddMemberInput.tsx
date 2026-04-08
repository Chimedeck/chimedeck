// AddMemberInput — typeahead input for adding a workspace member to the board.
// Excludes members already on the board and GUEST workspace members.
import { useState, useRef, useEffect } from 'react';
import type { BoardMemberRole } from '../../slices/boardMembersSlice';

interface WorkspaceMember {
  userId: string;
  email: string;
  role: string;
  name?: string | null;
}

const BOARD_ROLES: BoardMemberRole[] = ['MEMBER', 'VIEWER', 'ADMIN'];

interface Props {
  /** All workspace members (non-guest). Already filtered by caller. */
  candidates: WorkspaceMember[];
  onAdd: (userId: string, role: BoardMemberRole) => Promise<void>;
}

const AddMemberInput = ({ candidates, onAdd }: Props) => {
  const [query, setQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<BoardMemberRole>('MEMBER');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? candidates.filter((m) => {
        const q = query.toLowerCase();
        const name = (m.name ?? '').toLowerCase();
        return name.includes(q) || m.email.toLowerCase().includes(q);
      })
    : candidates;

  // Close dropdown when clicking outside.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = async (member: WorkspaceMember) => {
    setAdding(true);
    setOpen(false);
    setQuery('');
    try {
      await onAdd(member.userId, selectedRole);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search workspace members…"
            disabled={adding}
            className="w-full rounded border border-border bg-bg-overlay px-3 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            aria-label="Search workspace members to add"
            aria-autocomplete="list"
            aria-expanded={open}
          />
          {open && filtered.length > 0 && (
            <ul
              role="listbox"
              aria-label="Matching workspace members"
              className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-y-auto rounded border border-border bg-bg-surface shadow-xl"
            >
              {filtered.map((m) => (
                <li key={m.userId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSelect(m)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-subtle hover:bg-bg-overlay"
                  >
                    <span className="font-medium">{m.name ?? m.email}</span>
                    {m.name && (
                      <span className="text-xs text-muted">{m.email}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && query.trim() && filtered.length === 0 && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded border border-border bg-bg-surface px-3 py-2 text-sm text-muted shadow-xl">
              No matching members
            </div>
          )}
        </div>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as BoardMemberRole)}
          className="rounded border border-border bg-bg-surface px-2 py-1.5 text-xs text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Role for new board member"
        >
          {BOARD_ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default AddMemberInput;
