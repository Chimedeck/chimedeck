// BoardMemberFilter — "Filter by member" button that opens a searchable dropdown.
// Selecting members narrows the board to cards assigned to any of them.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UserIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';

const COLORS = [
  'bg-blue-600',
  'bg-green-700',
  'bg-purple-600',
  'bg-pink-600',
  'bg-amber-700',
];

function initials(displayName: string | null, email: string): string {
  const name = displayName ?? email;
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return `${(parts[0] ?? '').charAt(0)}${(parts[1] ?? '').charAt(0)}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export interface FilterMember {
  user_id: string;
  display_name: string | null;
  email: string;
  avatar_url?: string | null;
}

interface Props {
  members: FilterMember[];
  selectedIds: ReadonlySet<string>;
  onToggle: (userId: string) => void;
  onClear: () => void;
  hasBackground?: boolean;
}

export function BoardMemberFilter({
  members,
  selectedIds,
  onToggle,
  onClear,
  hasBackground = false,
}: Readonly<Props>): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { setOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, [open]);

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => { searchRef.current?.focus(); }, 0);
    } else {
      setQuery('');
    }
  }, [open]);

  const handleToggle = useCallback(
    (userId: string): void => { onToggle(userId); },
    [onToggle],
  );

  const handleClear = useCallback((): void => {
    onClear();
    setOpen(false);
  }, [onClear]);

  if (members.length === 0) return null;

  const filtered = query.trim()
    ? members.filter((m) => {
        const label = (m.display_name ?? m.email).toLowerCase();
        return label.includes(query.toLowerCase());
      })
    : members;

  const hasActive = selectedIds.size > 0;

  // Button styles vary between board-background and plain mode
  const btnBase = 'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary';
  let btnStyle: string;
  if (hasBackground) {
    btnStyle = hasActive ? 'bg-white/25 text-white hover:bg-white/30' : 'text-white/80 hover:text-white hover:bg-white/15';
  } else {
    btnStyle = hasActive ? 'bg-bg-overlay text-base hover:bg-bg-sunken' : 'text-muted hover:text-base hover:bg-bg-overlay';
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${btnBase} ${btnStyle}`}
      >
        <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {hasActive ? `Members (${String(selectedIds.size)})` : 'Filter members'}
        <ChevronDownIcon className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-60 rounded-lg border border-border bg-bg-surface shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); }}
              placeholder="Search members…"
              className="w-full rounded border border-border bg-bg-overlay px-2.5 py-1.5 text-xs text-base placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Member list */}
          <ul aria-label="Board members" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted">No members found</li>
            )}
            {filtered.map((member, i) => {
              const isActive = selectedIds.has(member.user_id);
              const label = member.display_name ?? member.email;
              const colorClass = COLORS[i % COLORS.length] ?? 'bg-blue-600';

              return (
              <li key={member.user_id}>
                  <button
                    type="button"
                    onClick={() => { handleToggle(member.user_id); }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs hover:bg-bg-overlay transition-colors"
                  >
                    {/* Avatar */}
                    <span
                      className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-inverse overflow-hidden ${member.avatar_url ? 'bg-bg-overlay' : colorClass}`}
                    >
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={label}
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        initials(member.display_name, member.email)
                      )}
                    </span>

                    {/* Name + email */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-base">{label}</span>
                      {member.display_name && (
                        <span className="block truncate text-muted">{member.email}</span>
                      )}
                    </span>

                    {/* Checkmark */}
                    {isActive && (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Footer clear action */}
          {hasActive && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={handleClear}
                className="flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-xs text-muted hover:text-base hover:bg-bg-overlay transition-colors"
              >
                <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

