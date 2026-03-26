// CardMetaStrip — compact horizontal strip below the card title showing labels, members, and dates.
// Replaces the sidebar sections for Labels, Members, Start Date, and Due Date (sprint-81 §4).
import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, UserIcon, TagIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import type { Label, CardMember } from '../api';
import { LabelChip } from './LabelChip';
import { CardDatesPicker } from './CardDatesPicker';
import CardValue from './CardValue';

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
  dueComplete: boolean;
  amount: string | null;
  currency: string | null;
  disabled?: boolean;
  onLabelAttach: (labelId: string) => Promise<void>;
  onLabelDetach: (labelId: string) => Promise<void>;
  onLabelCreate: (name: string, color: string) => Promise<void>;
  onLabelUpdate: (labelId: string, name: string, color: string) => Promise<void>;
  onMemberAssign: (userId: string) => Promise<void>;
  onMemberRemove: (userId: string) => Promise<void>;
  onMoneySave: (amount: string | null, currency: string) => Promise<void>;
  onStartDateChange: (date: string | null) => void;
  onDueDateChange: (date: string | null) => void;
  onDueCompleteChange: (done: boolean) => void;
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
    className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-gray-400 dark:hover:border-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors disabled:opacity-40 disabled:pointer-events-none"
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
// Colour grid used in create / edit forms
// ------------------------------------------------------------------
const ColorGrid = ({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (hex: string) => void;
}) => (
  <div className="grid grid-cols-4 gap-1.5">
    {PRESET_COLORS.map((c) => (
      <button
        key={c.hex}
        type="button"
        title={c.name}
        className={`h-7 w-full rounded-md transition-transform hover:scale-110 focus:outline-none ${
          selected === c.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''
        }`}
        style={{ backgroundColor: c.hex }}
        onClick={() => onChange(c.hex)}
        aria-label={c.name}
      />
    ))}
  </div>
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
  onUpdate,
}: {
  labels: Label[];
  allLabels: Label[];
  disabled?: boolean;
  onAttach: (id: string) => Promise<void>;
  onDetach: (id: string) => Promise<void>;
  onCreate: (name: string, color: string) => Promise<void>;
  onUpdate: (id: string, name: string, color: string) => Promise<void>;
}) => {
  const { open, setOpen, ref } = usePopover();
  // View is 'list', 'create', or a label id (edit mode)
  const [view, setView] = useState<string>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[6]?.hex ?? '#6366f1');
  const [saving, setSaving] = useState(false);

  const assignedIds = new Set(labels.map((l) => l.id));
  const visibleLabels = labels.slice(0, MAX_VISIBLE);
  const overflow = labels.length - MAX_VISIBLE;

  const resetToList = () => {
    setView('list');
    setFormName('');
    setFormColor(PRESET_COLORS[6]?.hex ?? '#6366f1');
  };

  const openEdit = (label: Label) => {
    setFormName(label.name);
    setFormColor(label.color);
    setView(label.id);
  };

  const handleToggle = async (label: Label) => {
    if (assignedIds.has(label.id)) await onDetach(label.id);
    else await onAttach(label.id);
  };

  const handleCreate = async () => {
    const name = formName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await onCreate(name, formColor);
      resetToList();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (typeof view !== 'string' || view === 'list' || view === 'create') return;
    const name = formName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await onUpdate(view, name, formColor);
      resetToList();
    } finally {
      setSaving(false);
    }
  };

  const filteredLabels = allLabels.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isEditingLabel = view !== 'list' && view !== 'create';
  const editingLabel = isEditingLabel ? allLabels.find((l) => l.id === view) : null;

  return (
    <div className="relative flex items-center gap-1 flex-wrap" ref={ref}>
      {visibleLabels.map((label) => (
        <LabelChip
          key={label.id}
          label={label}
          {...(!disabled && { onRemove: () => { void onDetach(label.id); } })}
        />
      ))}
      {overflow > 0 && (
        <span className="text-xs text-gray-400 font-medium">+{overflow}</span>
      )}
      {!disabled && (
        <PillButton
          onClick={() => { setOpen((v) => !v); resetToList(); setSearchQuery(''); }}
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
          <div
            className="absolute left-0 top-full mt-1 z-20 w-72 rounded-xl bg-white border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[min(28rem,80vh)]"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              {(view === 'list') ? (
                <span className="text-sm font-semibold text-gray-700">Labels</span>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-slate-200"
                  onClick={resetToList}
                >
                  ← {view === 'create' ? 'Create label' : `Edit label`}
                </button>
              )}
              <button
                type="button"
                className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* ── List view ── */}
            {view === 'list' && (
              <div className="p-2 space-y-1 overflow-y-auto flex-1 min-h-0">
                <input
                  className="w-full bg-bg-overlay border border-border rounded-lg px-2.5 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary mb-1"
                  placeholder="Search labels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {filteredLabels.length === 0 && (
                  <p className="text-xs text-gray-400 px-2 py-1">No labels found</p>
                )}
                {filteredLabels.length > 0 && (
                  <p className="text-xs font-semibold text-gray-500 px-1 pb-0.5">Labels</p>
                )}
                {filteredLabels.map((label) => {
                  const assigned = assignedIds.has(label.id);
                  return (
                    <div key={label.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={assigned}
                        onChange={() => void handleToggle(label)}
                        className="h-3.5 w-3.5 rounded border-gray-400 accent-indigo-500 cursor-pointer flex-shrink-0"
                        aria-label={`Toggle ${label.name}`}
                      />
                      <button
                        type="button"
                        className="flex-1 flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 min-w-0 truncate"
                        style={{ backgroundColor: label.color }}
                        onClick={() => void handleToggle(label)}
                        title={label.name}
                      >
                        {label.name}
                      </button>
                      <button
                        type="button"
                        className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                        onClick={() => openEdit(label)}
                        aria-label={`Edit ${label.name}`}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="w-full mt-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:hover:bg-slate-600 text-sm text-gray-700 py-1.5 transition-colors"
                  onClick={() => { setFormName(''); setFormColor(PRESET_COLORS[6]?.hex ?? '#6366f1'); setView('create'); }}
                >
                  Create a new label
                </button>
              </div>
            )}

            {/* ── Create / Edit form ── */}
            {(view === 'create' || isEditingLabel) && (
              <div className="p-3 space-y-3">
                {/* Preview */}
                <div
                  className="w-full rounded-md px-3 py-2 text-sm font-semibold text-white text-center truncate"
                  style={{ backgroundColor: formColor }}
                >
                  {formName || (isEditingLabel ? editingLabel?.name : 'Label preview')}
                </div>
                {/* Name input */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Title</p>
                  <input
                    id="label-form-name"
                    className="w-full bg-bg-overlay border border-border rounded-lg px-2.5 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Label name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { void (view === 'create' ? handleCreate() : handleSaveEdit()); } }}
                    autoFocus
                  />
                </div>
                {/* Colour grid */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Colour</p>
                  <ColorGrid selected={formColor} onChange={setFormColor} />
                </div>
                {/* Actions */}
                <button
                  type="button"
                  className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-1.5 transition-colors disabled:opacity-50"
                  onClick={() => void (view === 'create' ? handleCreate() : handleSaveEdit())}
                  disabled={saving || !formName.trim()}
                >
                  {saving && 'Saving…'}
                  {!saving && view === 'create' && 'Create'}
                  {!saving && view !== 'create' && 'Save'}
                </button>
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
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white ring-2 ring-white"
          >
            {getInitials(m.name, m.email ?? '')}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-500 ring-2 ring-white">
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
          <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl bg-white border border-gray-200 shadow-2xl p-2 space-y-1">
            {boardMembers.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-1">No board members</p>
            )}
            {boardMembers.map((member) => {
              const assigned = assignedIds.has(member.id);
              const name = member.name ?? member.email;
              return (
                <button
                  key={member.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
// Dates button — single pill opening the combined CardDatesPicker
// ------------------------------------------------------------------
type DueDateStatus = 'done' | 'overdue' | 'due-soon' | 'normal';

function getDueDateStatus(dueDate: string, dueComplete: boolean): DueDateStatus {
  if (dueComplete) return 'done';
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  if (due < now) return 'overdue';
  if (due - now < 24 * 60 * 60 * 1000) return 'due-soon';
  return 'normal';
}

function getDuePillClass(status: DueDateStatus, hasDate: boolean): string {
  if (status === 'done') return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700';
  if (status === 'overdue') return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700';
  if (status === 'due-soon') return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-700';
  if (hasDate) return 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-200';
  return 'border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 dark:hover:border-slate-500 hover:text-gray-700 dark:hover:text-slate-300';
}

function getDueCheckboxClass(status: DueDateStatus): string {
  if (status === 'done') return 'bg-emerald-500 border-emerald-500';
  if (status === 'overdue') return 'bg-red-500 border-red-500';
  if (status === 'due-soon') return 'bg-orange-400 border-orange-400';
  return 'border-gray-300 bg-white';
}

const DatesButton = ({
  startDate,
  dueDate,
  dueComplete,
  onStartDateChange,
  onDueDateChange,
  onDueCompleteChange,
  disabled,
}: {
  startDate: string | null;
  dueDate: string | null;
  dueComplete: boolean;
  onStartDateChange: (date: string | null) => void;
  onDueDateChange: (date: string | null) => void;
  onDueCompleteChange: (done: boolean) => void;
  disabled?: boolean;
}) => {
  const { open, setOpen, ref } = usePopover();
  const status = dueDate ? getDueDateStatus(dueDate, dueComplete) : 'normal';
  const pillClass = getDuePillClass(status, !!(dueDate ?? startDate));
  const checkboxClass = getDueCheckboxClass(status);

  const pillLabel = (() => {
    if (dueDate && startDate) return `${formatDate(startDate)} → ${formatDate(dueDate)}`;
    if (dueDate) return formatDate(dueDate);
    if (startDate) return `${formatDate(startDate)} →`;
    return '+ Dates';
  })();

  const handleSave = (start: string | null, due: string | null) => {
    onStartDateChange(start);
    onDueDateChange(due);
    setOpen(false);
  };

  const handleRemove = () => {
    onStartDateChange(null);
    onDueDateChange(null);
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      {dueDate && (
        <button
          type="button"
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${checkboxClass} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          onClick={(e) => { e.stopPropagation(); onDueCompleteChange(!dueComplete); }}
          aria-label={dueComplete ? 'Mark as not done' : 'Mark as done'}
          disabled={disabled}
        >
          {dueComplete && <CheckIcon className="h-2.5 w-2.5 text-white" aria-hidden="true" />}
        </button>
      )}
      <button
        type="button"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none ${pillClass}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Dates"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        {pillLabel}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full mt-1 z-20">
            <CardDatesPicker
              startDate={startDate}
              dueDate={dueDate}
              disabled={disabled}
              onSave={handleSave}
              onRemove={handleRemove}
              onClose={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// Money button + popover editor
// ------------------------------------------------------------------
function formatMoney(amount: string, currency: string | null): string {
  const numericAmount = Number.parseFloat(amount);
  if (Number.isNaN(numericAmount)) return '$';

  const currencyCode = currency || 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: numericAmount % 1 === 0 ? 0 : 2,
    }).format(numericAmount);
  } catch {
    return `${currencyCode} ${numericAmount}`;
  }
}

const MoneyButton = ({
  amount,
  currency,
  disabled,
  onMoneySave,
}: {
  amount: string | null;
  currency: string | null;
  disabled?: boolean;
  onMoneySave: (amount: string | null, currency: string) => Promise<void>;
}) => {
  const { open, setOpen, ref } = usePopover();

  const pillText = amount ? formatMoney(amount, currency) : '$';
  const pillClass = amount
    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
    : 'border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 dark:hover:border-slate-500 hover:text-gray-700 dark:hover:text-slate-300';

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none ${pillClass}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Card pricing"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="text-xs font-semibold leading-none">$</span>
        {amount && <span>{pillText}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl bg-white border border-gray-200 shadow-2xl p-3">
            <CardValue
              amount={amount}
              currency={currency}
              onSave={onMoneySave}
              disabled={disabled}
            />
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
  amount,
  currency,
  startDate,
  dueDate,
  dueComplete,
  disabled,
  onLabelAttach,
  onLabelDetach,
  onLabelCreate,
  onLabelUpdate,
  onMemberAssign,
  onMemberRemove,
  onMoneySave,
  onStartDateChange,
  onDueDateChange,
  onDueCompleteChange,
}: CardMetaStripProps) => {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-1.5"
      aria-label="Card metadata: labels, members, pricing, and dates"
    >
      {/* Labels */}
      <LabelSection
        labels={labels}
        allLabels={allLabels}
        {...(disabled && { disabled })}
        onAttach={onLabelAttach}
        onDetach={onLabelDetach}
        onCreate={onLabelCreate}
        onUpdate={onLabelUpdate}
      />

      {/* Divider */}
      <span className="h-4 w-px bg-gray-200 flex-shrink-0" aria-hidden="true" />

      {/* Members */}
      <MemberSection
        members={members}
        boardMembers={boardMembers}
        {...(disabled && { disabled })}
        onAssign={onMemberAssign}
        onRemove={onMemberRemove}
      />

      {/* Divider */}
      <span className="h-4 w-px bg-gray-200 flex-shrink-0" aria-hidden="true" />

      {/* Pricing */}
      <MoneyButton
        amount={amount}
        currency={currency}
        onMoneySave={onMoneySave}
        {...(disabled && { disabled })}
      />

      {/* Divider */}
      <span className="h-4 w-px bg-gray-200 flex-shrink-0" aria-hidden="true" />

      {/* Dates */}
      <DatesButton
        startDate={startDate}
        dueDate={dueDate}
        dueComplete={dueComplete}
        onStartDateChange={onStartDateChange}
        onDueDateChange={onDueDateChange}
        onDueCompleteChange={onDueCompleteChange}
        {...(disabled && { disabled })}
      />
    </div>
  );
};

export default CardMetaStrip;
