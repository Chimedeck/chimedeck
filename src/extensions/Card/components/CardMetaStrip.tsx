// CardMetaStrip — compact horizontal strip below the card title showing labels, members, and dates.
// Replaces the sidebar sections for Labels, Members, Start Date, and Due Date (sprint-81 §4).
import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, PlusIcon, UserIcon, TagIcon } from '@heroicons/react/24/outline';
import type { Label, CardMember } from '../api';
import { LabelChip } from './LabelChip';

const PRESET_COLORS = [
  { name: 'Slate', hex: '#64748b' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Purple', hex: '#a855f7' },
];

const MAX_VISIBLE = 3;

interface BoardMember {
  id: string;
  email: string;
  name: string | null;
}

export interface CardMetaStripProps {
  labels: Label[];
  allLabels: Label[];
  members: CardMember[];
  boardMembers: BoardMember[];
  cardId: string;
  currentUserId: string;
  startDate: string | null;
  dueDate: string | null;
  disabled?: boolean;
  onLabelAttach: (labelId: string) => Promise<void>;
  onLabelDetach: (labelId: string) => Promise<void>;
  onLabelCreate: (name: string, color: string) => Promise<void>;
  onMemberAssign: (userId: string) => Promise<void>;
  onMemberRemove: (userId: string) => Promise<void>;
  onStartDateChange: (date: string | null) => void;
  onDueDateChange: (date: string | null) => void;
}

// ------------------------------------------------------------------
// Small popover wrapper: closes on outside click + Escape
// ------------------------------------------------------------------
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return { open, setOpen, ref };
}

function getInitials(name: string | null, email: string) {
  const src = name ?? email;
  return src.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ------------------------------------------------------------------
// Pill button used for the "Add…" actions
// ------------------------------------------------------------------
const PillButton = ({
  onClick,
  disabled,
  children,
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHaspopup,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'listbox' | 'tree' | 'grid' | 'dialog';
}) => (
  <button
    type="button"
    className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 dark:border-slate-600 px-2 py-0.5 text-xs text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors disabled:opacity-40 disabled:pointer-events-none"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    aria-expanded={ariaExpanded}
    aria-haspopup={ariaHaspopup}
  >
    {children}
  </button>
);

// ------------------------------------------------------------------
// Label section
// ------------------------------------------------------------------
const LabelSection = ({
  labels,
  allLabels,
  disabled,
  onAttach,
  onDetach,
  onCreate,
}: {
  labels: Label[];
  allLabels: Label[];
  disabled?: boolean;
  onAttach: (id: string) => Promise<void>;
  onDetach: (id: string) => Promise<void>;
  onCreate: (name: string, color: string) => Promise<void>;
}) => {
  const { open, setOpen, ref } = usePopover();
  const [newName, setNewName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[6]?.hex ?? '#6366f1');
  const [creating, setCreating] = useState(false);

  const assignedIds = new Set(labels.map((l) => l.id));
  const visibleLabels = labels.slice(0, MAX_VISIBLE);
  const overflow = labels.length - MAX_VISIBLE;

  const handleToggle = async (label: Label) => {
    if (assignedIds.has(label.id)) await onDetach(label.id);
    else await onAttach(label.id);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate(name, color);
      setNewName('');
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const unassigned = allLabels.filter(
    (l) => !assignedIds.has(l.id) && l.name.toLowerCase().includes(newName.toLowerCase()),
  );

  return (
    <div className="relative flex items-center gap-1 flex-wrap" ref={ref}>
      {visibleLabels.map((label) => (
        <LabelChip
          key={label.id}
          label={label}
          {...(!disabled && { onRemove: () => onDetach(label.id) })}
        />
      ))}
      {overflow > 0 && (
        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">+{overflow}</span>
      )}
      {!disabled && (
        <PillButton
          onClick={() => setOpen((v) => !v)}
          aria-label="Manage labels"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <TagIcon className="h-3 w-3" aria-hidden="true" />
          {labels.length === 0 ? '+ Labels' : '+'}
        </PillButton>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full mt-1 z-20 w-64 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xl p-3 space-y-3">
            <input
              className="w-full bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Label name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
            <div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-1.5">Colour</p>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.name}
                    className={`h-7 w-full rounded-md transition-transform hover:scale-110 focus:outline-none ${color === c.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''}`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => setColor(c.hex)}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>
            {newName.trim() && (
              <button
                type="button"
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-1.5 transition-colors disabled:opacity-50"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'Creating…' : `Create "${newName.trim()}"`}
              </button>
            )}
            {unassigned.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-400 dark:text-slate-500">Existing labels</p>
                {unassigned.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => handleToggle(label)}
                  >
                    <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                    {label.name}
                  </button>
                ))}
              </div>
            )}
            {labels.length > 0 && (
              <div className="space-y-1 border-t border-gray-200 dark:border-slate-700 pt-2">
                <p className="text-xs text-gray-400 dark:text-slate-500">Assigned</p>
                {labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => handleToggle(label)}
                  >
                    <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                    {label.name}
                    <span className="ml-auto text-emerald-400">✓</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// Member section
// ------------------------------------------------------------------
const MemberSection = ({
  members,
  boardMembers,
  disabled,
  onAssign,
  onRemove,
}: {
  members: CardMember[];
  boardMembers: BoardMember[];
  disabled?: boolean;
  onAssign: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) => {
  const { open, setOpen, ref } = usePopover();
  const assignedIds = new Set(members.map((m) => m.id));
  const visibleMembers = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - MAX_VISIBLE;

  const handleToggle = async (member: BoardMember) => {
    if (assignedIds.has(member.id)) await onRemove(member.id);
    else await onAssign(member.id);
  };

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      {visibleMembers.map((m) => {
        const name = m.name ?? m.email ?? '';
        return (
          <span
            key={m.id}
            title={name}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900"
          >
            {getInitials(m.name, m.email ?? '')}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 dark:bg-slate-700 text-[10px] font-semibold text-gray-500 dark:text-slate-400 ring-2 ring-white dark:ring-slate-900">
          +{overflow}
        </span>
      )}
      {!disabled && (
        <PillButton
          onClick={() => setOpen((v) => !v)}
          aria-label="Assign members"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <UserIcon className="h-3 w-3" aria-hidden="true" />
          {members.length === 0 ? '+ Members' : '+'}
        </PillButton>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xl p-2 space-y-1">
            {boardMembers.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 px-2 py-1">No board members</p>
            )}
            {boardMembers.map((member) => {
              const assigned = assignedIds.has(member.id);
              const name = member.name ?? member.email;
              return (
                <button
                  key={member.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  onClick={() => handleToggle(member)}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white flex-shrink-0">
                    {getInitials(member.name, member.email)}
                  </span>
                  <span className="flex-1 truncate">{name}</span>
                  {assigned && <span className="text-emerald-400">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// Date button (start or due)
// ------------------------------------------------------------------
const DateButton = ({
  label,
  date,
  onChange,
  disabled,
}: {
  label: string;
  date: string | null;
  onChange: (date: string | null) => void;
  disabled?: boolean;
}) => {
  const { open, setOpen, ref } = usePopover();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none ${
          date
            ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600'
            : 'border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500 hover:text-gray-700 dark:hover:text-slate-300'
        }`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        {date ? formatDate(date) : label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full mt-1 z-20 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xl p-3 space-y-2 min-w-[180px]">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
            <input
              type="date"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
              value={date ? date.slice(0, 10) : ''}
              onChange={(e) => onChange(e.target.value || null)}
              autoFocus
            />
            {date && (
              <button
                type="button"
                className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
                onClick={() => { onChange(null); setOpen(false); }}
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// Main CardMetaStrip
// ------------------------------------------------------------------
const CardMetaStrip = ({
  labels,
  allLabels,
  members,
  boardMembers,
  startDate,
  dueDate,
  disabled,
  onLabelAttach,
  onLabelDetach,
  onLabelCreate,
  onMemberAssign,
  onMemberRemove,
  onStartDateChange,
  onDueDateChange,
}: CardMetaStripProps) => {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-1.5"
      role="group"
      aria-label="Card metadata: labels, members, and dates"
    >
      {/* Labels */}
      <LabelSection
        labels={labels}
        allLabels={allLabels}
        {...(disabled && { disabled })}
        onAttach={onLabelAttach}
        onDetach={onLabelDetach}
        onCreate={onLabelCreate}
      />

      {/* Divider */}
      <span className="h-4 w-px bg-gray-200 dark:bg-slate-700 flex-shrink-0" aria-hidden="true" />

      {/* Members */}
      <MemberSection
        members={members}
        boardMembers={boardMembers}
        {...(disabled && { disabled })}
        onAssign={onMemberAssign}
        onRemove={onMemberRemove}
      />

      {/* Divider */}
      <span className="h-4 w-px bg-gray-200 dark:bg-slate-700 flex-shrink-0" aria-hidden="true" />

      {/* Dates */}
      <DateButton
        label="Start date"
        date={startDate}
        onChange={onStartDateChange}
        {...(disabled && { disabled })}
      />
      <DateButton
        label="Due date"
        date={dueDate}
        onChange={onDueDateChange}
        {...(disabled && { disabled })}
      />
    </div>
  );
};

export default CardMetaStrip;
