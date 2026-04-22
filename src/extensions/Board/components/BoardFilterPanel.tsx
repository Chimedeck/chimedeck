// BoardFilterPanel — comprehensive card filter panel.
// Replaces the separate BoardMemberFilter dropdown and BoardSearchBar.
import { useEffect, useState, type RefObject } from 'react';
import {
  MagnifyingGlassIcon,
  UserCircleIcon,
  TagIcon,
  CalendarDaysIcon,
  BoltIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { contrastText } from '~/extensions/Card/components/LabelChip';
import type { Card } from '~/extensions/Card/api';

// ── Filter state ───────────────────────────────────────────────────────────────

export interface BoardFilters {
  keyword: string;
  noMembers: boolean;
  assignedToMe: boolean;
  memberIds: Set<string>;
  dueComplete: 'all' | 'complete' | 'incomplete';
  dueDate: 'all' | 'noDate' | 'overdue' | 'dueDay' | 'dueWeek' | 'dueMonth';
  noLabels: boolean;
  labelIds: Set<string>;
  activity: 'all' | 'week' | 'twoWeeks' | 'fourWeeks' | 'noActivity';
  collapseLists: boolean;
}

export const DEFAULT_FILTERS: BoardFilters = {
  keyword: '',
  noMembers: false,
  assignedToMe: false,
  memberIds: new Set(),
  dueComplete: 'all',
  dueDate: 'all',
  noLabels: false,
  labelIds: new Set(),
  activity: 'all',
  collapseLists: false,
};

export function countActiveFilters(f: BoardFilters): number {
  let n = 0;
  if (f.keyword.trim()) n++;
  if (f.noMembers) n++;
  if (f.assignedToMe) n++;
  n += f.memberIds.size;
  if (f.dueComplete !== 'all') n++;
  if (f.dueDate !== 'all') n++;
  if (f.noLabels) n++;
  n += f.labelIds.size;
  if (f.activity !== 'all') n++;
  return n;
}

// ── Filter helpers (extracted to keep applyBoardFilter complexity low) ────────

function passesKeyword(card: Card, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  return (
    card.title.toLowerCase().includes(kw) ||
    (card.description?.toLowerCase().includes(kw) ?? false)
  );
}

function passesMembersFilter(
  card: Card,
  filters: BoardFilters,
  currentUserId: string | undefined,
): boolean {
  const { noMembers, assignedToMe, memberIds } = filters;
  if (!noMembers && !assignedToMe && memberIds.size === 0) return true;
  const members = Array.isArray(card.members) ? card.members : [];
  return (
    (noMembers && members.length === 0) ||
    (assignedToMe && !!currentUserId && members.some((m) => m.id === currentUserId)) ||
    (memberIds.size > 0 && members.some((m) => memberIds.has(m.id)))
  );
}

function passesDueDate(card: Card, dueDate: BoardFilters['dueDate']): boolean {
  if (dueDate === 'all') return true;
  const now = Date.now();
  const DAY = 86_400_000;
  const dueTs = card.due_date ? new Date(card.due_date).getTime() : null;
  if (dueDate === 'noDate') return dueTs === null;
  // [why] overdue and upcoming due-date filters all exclude cards already marked complete
  if (dueDate === 'overdue') return dueTs !== null && dueTs < now && !card.due_complete;
  if (dueDate === 'dueDay') return dueTs !== null && dueTs <= now + DAY && !card.due_complete;
  if (dueDate === 'dueWeek') return dueTs !== null && dueTs <= now + 7 * DAY && !card.due_complete;
  if (dueDate === 'dueMonth') return dueTs !== null && dueTs <= now + 30 * DAY && !card.due_complete;
  return true;
}

function passesLabelsFilter(card: Card, filters: BoardFilters): boolean {
  const { noLabels, labelIds } = filters;
  if (!noLabels && labelIds.size === 0) return true;
  const labels = Array.isArray(card.labels) ? card.labels : [];
  return (
    (noLabels && labels.length === 0) ||
    (labelIds.size > 0 && labels.some((l) => labelIds.has(l.id)))
  );
}

function passesActivity(card: Card, activity: BoardFilters['activity']): boolean {
  if (activity === 'all') return true;
  // [why] use created_at as the activity date when the card has never been edited
  // (updated_at === created_at means no user activity has occurred since creation).
  const activityDate = card.updated_at === card.created_at ? card.created_at : card.updated_at;
  const activityMs = new Date(activityDate).getTime();
  const age = Date.now() - activityMs;
  const WEEK = 7 * 86_400_000;
  if (activity === 'week') return age <= WEEK;
  if (activity === 'twoWeeks') return age <= 2 * WEEK;
  if (activity === 'fourWeeks') return age <= 4 * WEEK;
  if (activity === 'noActivity') return age > 4 * WEEK;
  return true;
}

/** Returns true when the card passes all active filters. */
export function applyBoardFilter(
  card: Card,
  filters: BoardFilters,
  currentUserId?: string,
): boolean {
  return (
    passesKeyword(card, filters.keyword) &&
    passesMembersFilter(card, filters, currentUserId) &&
    (filters.dueComplete === 'all' ||
      (filters.dueComplete === 'complete' ? card.due_complete : !card.due_complete)) &&
    passesDueDate(card, filters.dueDate) &&
    passesLabelsFilter(card, filters) &&
    passesActivity(card, filters.activity)
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const SectionHeading = ({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: string;
}) => (
  <p className="flex items-center gap-1.5 px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted first:pt-1">
    <span aria-hidden="true">{icon}</span>
    {children}
  </p>
);

const CheckRow = ({
  checked,
  onChange,
  children,
  swatch,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  swatch?: { color: string };
}) => (
  <button
    type="button"
    onClick={onChange}
    className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-bg-overlay text-base"
  >
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
        checked ? 'border-primary bg-primary' : 'border-border bg-bg-overlay'
      }`}
    >
      {checked && <CheckIcon className="h-3 w-3 text-white" aria-hidden="true" />}
    </span>
    {swatch ? (
      <span
        className="flex-1 rounded px-2 py-0.5 text-xs font-semibold"
        style={{ backgroundColor: swatch.color, color: contrastText(swatch.color) }}
      >
        {children}
      </span>
    ) : (
      <span className="flex-1">{children}</span>
    )}
  </button>
);

/** Small avatar circle — image if available, otherwise initials. */
const MemberAvatar = ({ member }: { member: FilterMember }) => {
  const label = member.display_name ?? member.email;
  return member.avatar_url ? (
    <img
      src={member.avatar_url}
      alt={label}
      className="h-6 w-6 rounded-full object-cover shrink-0"
    />
  ) : (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary select-none">
      {label.charAt(0).toUpperCase()}
    </span>
  );
};

/** Row with avatar + display name + @handle. */
const MemberCheckRow = ({
  member,
  checked,
  onChange,
}: {
  member: FilterMember;
  checked: boolean;
  onChange: () => void;
}) => (
  <button
    type="button"
    onClick={onChange}
    className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-bg-overlay"
  >
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
        checked ? 'border-primary bg-primary' : 'border-border bg-bg-overlay'
      }`}
    >
      {checked && <CheckIcon className="h-3 w-3 text-white" aria-hidden="true" />}
    </span>
    <MemberAvatar member={member} />
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-sm text-base leading-tight">
        {member.display_name ?? member.email}
      </span>
      {member.display_name && (
        <span className="truncate text-[11px] text-muted leading-tight">
          @{member.email.split('@')[0]}
        </span>
      )}
    </span>
  </button>
);

// ── Main component ─────────────────────────────────────────────────────────────

export interface FilterMember {
  user_id: string;
  display_name: string | null;
  email: string;
  avatar_url?: string | null;
}

interface Props {
  /** Ref of the container wrapping both the trigger button and this panel (for click-outside). */
  containerRef: RefObject<HTMLElement>;
  onClose: () => void;
  filters: BoardFilters;
  onChange: (next: BoardFilters) => void;
  boardMembers: FilterMember[];
  boardLabels: Array<{ id: string; name: string; color: string }>;
  currentUserId?: string;
}

const TOP_LABELS = 3;

export default function BoardFilterPanel({
  containerRef,
  onClose,
  filters,
  onChange,
  boardMembers,
  boardLabels,
  currentUserId,
}: Readonly<Props>) {
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');

  // Close when clicking outside the container (which includes the trigger button)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [containerRef, onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch });

  const toggleMemberId = (id: string) => {
    const next = new Set(filters.memberIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    set({ memberIds: next });
  };

  const toggleLabelId = (id: string) => {
    const next = new Set(filters.labelIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    set({ labelIds: next });
  };

  const toggleDueDate = (v: BoardFilters['dueDate']) =>
    set({ dueDate: filters.dueDate === v ? 'all' : v });

  const toggleDueComplete = (v: 'complete' | 'incomplete') =>
    set({ dueComplete: filters.dueComplete === v ? 'all' : v });

  const toggleActivity = (v: BoardFilters['activity']) =>
    set({ activity: filters.activity === v ? 'all' : v });

  // Derived member data
  const currentMember = boardMembers.find((m) => m.user_id === currentUserId);
  const otherMembers = boardMembers.filter((m) => m.user_id !== currentUserId);
  const filteredMemberSearch = memberSearch.trim().toLowerCase();
  const searchedMembers = filteredMemberSearch
    ? otherMembers.filter(
        (m) =>
          (m.display_name ?? '').toLowerCase().includes(filteredMemberSearch) ||
          m.email.toLowerCase().includes(filteredMemberSearch),
      )
    : otherMembers;

  // Derived label data
  const topLabels = boardLabels.slice(0, TOP_LABELS);
  const hasMoreLabels = boardLabels.length > TOP_LABELS;
  const filteredLabelSearch = labelSearch.trim().toLowerCase();
  const searchedLabels = filteredLabelSearch
    ? boardLabels.filter((l) => l.name.toLowerCase().includes(filteredLabelSearch))
    : boardLabels;

  return (
    <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-bg-surface shadow-2xl overflow-y-auto max-h-[min(80vh,640px)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-sm font-semibold text-base">Filter</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-subtle hover:text-base transition-colors"
          aria-label="Close filter panel"
        >
          ✕
        </button>
      </div>

      <div className="p-2">
        {/* Keyword */}
        <div className="flex items-center gap-2 rounded border border-border bg-bg-overlay px-2.5 py-1.5 mb-1">
          <MagnifyingGlassIcon className="h-4 w-4 text-muted shrink-0" aria-hidden="true" />
          <input
            type="search"
            placeholder="Enter a keyword..."
            value={filters.keyword}
            onChange={(e) => set({ keyword: e.target.value })}
            className="flex-1 bg-transparent text-sm text-base placeholder:text-muted focus:outline-none"
            // [why] autoFocus so the user can start typing immediately after opening the panel
            autoFocus
          />
        </div>
        <p className="px-2 pb-1 text-xs text-muted">Search cards, members, labels, and more.</p>

        {/* ── Members ── */}
        <SectionHeading icon={<UserCircleIcon className="h-3.5 w-3.5" />}>Members</SectionHeading>

        {/* Static rows */}
        <CheckRow
          checked={filters.noMembers}
          onChange={() => set({ noMembers: !filters.noMembers })}
        >
          No members
        </CheckRow>
        {currentMember ? (
          <MemberCheckRow
            member={currentMember}
            checked={filters.assignedToMe}
            onChange={() => set({ assignedToMe: !filters.assignedToMe })}
          />
        ) : (
          <CheckRow
            checked={filters.assignedToMe}
            onChange={() => set({ assignedToMe: !filters.assignedToMe })}
          >
            Cards assigned to me
          </CheckRow>
        )}

        {/* Members from dropdown (selected non-current members shown inline) */}
        {otherMembers
          .filter((m) => filters.memberIds.has(m.user_id))
          .map((m) => (
            <MemberCheckRow
              key={m.user_id}
              member={m}
              checked
              onChange={() => toggleMemberId(m.user_id)}
            />
          ))}

        {/* Select members dropdown trigger */}
        {otherMembers.length > 0 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setMemberDropdownOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded border border-border bg-bg-overlay px-2.5 py-1.5 text-sm text-muted hover:text-base transition-colors"
            >
              <span>Select members</span>
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${memberDropdownOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {memberDropdownOpen && (
              <div className="mt-1 rounded border border-border bg-bg-overlay overflow-hidden">
                {/* Search input */}
                <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
                  <MagnifyingGlassIcon className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-base placeholder:text-muted focus:outline-none"
                  />
                </div>
                {/* Member list */}
                <div className="max-h-44 overflow-y-auto py-1">
                  {searchedMembers.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted">No members found</p>
                  ) : (
                    searchedMembers.map((m) => (
                      <MemberCheckRow
                        key={m.user_id}
                        member={m}
                        checked={filters.memberIds.has(m.user_id)}
                        onChange={() => toggleMemberId(m.user_id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Card status ── */}
        <SectionHeading icon={<BoltIcon className="h-3.5 w-3.5" />}>Card status</SectionHeading>
        <CheckRow
          checked={filters.dueComplete === 'complete'}
          onChange={() => toggleDueComplete('complete')}
        >
          Marked as complete
        </CheckRow>
        <CheckRow
          checked={filters.dueComplete === 'incomplete'}
          onChange={() => toggleDueComplete('incomplete')}
        >
          Not marked as complete
        </CheckRow>

        {/* ── Due date ── */}
        <SectionHeading icon={<CalendarDaysIcon className="h-3.5 w-3.5" />}>Due date</SectionHeading>
        <CheckRow checked={filters.dueDate === 'noDate'} onChange={() => toggleDueDate('noDate')}>
          No dates
        </CheckRow>
        <CheckRow checked={filters.dueDate === 'overdue'} onChange={() => toggleDueDate('overdue')}>
          Overdue
        </CheckRow>
        <CheckRow checked={filters.dueDate === 'dueDay'} onChange={() => toggleDueDate('dueDay')}>
          Due in the next day
        </CheckRow>
        <CheckRow checked={filters.dueDate === 'dueWeek'} onChange={() => toggleDueDate('dueWeek')}>
          Due in the next week
        </CheckRow>
        <CheckRow checked={filters.dueDate === 'dueMonth'} onChange={() => toggleDueDate('dueMonth')}>
          Due in the next month
        </CheckRow>

        {/* ── Labels ── */}
        <SectionHeading icon={<TagIcon className="h-3.5 w-3.5" />}>Labels</SectionHeading>
        <CheckRow
          checked={filters.noLabels}
          onChange={() => set({ noLabels: !filters.noLabels })}
        >
          No labels
        </CheckRow>

        {/* Top 3 labels always visible */}
        {topLabels.map((label) => (
          <CheckRow
            key={label.id}
            checked={filters.labelIds.has(label.id)}
            onChange={() => toggleLabelId(label.id)}
            swatch={{ color: label.color }}
          >
            {label.name}
          </CheckRow>
        ))}

        {/* Selected labels beyond top 3 shown inline so they're always visible */}
        {boardLabels.slice(TOP_LABELS).filter((l) => filters.labelIds.has(l.id)).map((label) => (
          <CheckRow
            key={label.id}
            checked
            onChange={() => toggleLabelId(label.id)}
            swatch={{ color: label.color }}
          >
            {label.name}
          </CheckRow>
        ))}

        {/* Select labels dropdown */}
        {hasMoreLabels && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setLabelDropdownOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded border border-border bg-bg-overlay px-2.5 py-1.5 text-sm text-muted hover:text-base transition-colors"
            >
              <span>Select labels</span>
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${labelDropdownOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {labelDropdownOpen && (
              <div className="mt-1 rounded border border-border bg-bg-overlay overflow-hidden">
                {/* Search input */}
                <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
                  <MagnifyingGlassIcon className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Search labels..."
                    value={labelSearch}
                    onChange={(e) => setLabelSearch(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-base placeholder:text-muted focus:outline-none"
                  />
                </div>
                {/* Label list */}
                <div className="max-h-44 overflow-y-auto py-1">
                  {searchedLabels.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted">No labels found</p>
                  ) : (
                    searchedLabels.map((label) => (
                      <CheckRow
                        key={label.id}
                        checked={filters.labelIds.has(label.id)}
                        onChange={() => toggleLabelId(label.id)}
                        swatch={{ color: label.color }}
                      >
                        {label.name}
                      </CheckRow>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Activity ── */}
        <SectionHeading icon={<BoltIcon className="h-3.5 w-3.5" />}>Activity</SectionHeading>
        <CheckRow
          checked={filters.activity === 'week'}
          onChange={() => toggleActivity('week')}
        >
          Active in the last week
        </CheckRow>
        <CheckRow
          checked={filters.activity === 'twoWeeks'}
          onChange={() => toggleActivity('twoWeeks')}
        >
          Active in the last two weeks
        </CheckRow>
        <CheckRow
          checked={filters.activity === 'fourWeeks'}
          onChange={() => toggleActivity('fourWeeks')}
        >
          Active in the last four weeks
        </CheckRow>
        <CheckRow
          checked={filters.activity === 'noActivity'}
          onChange={() => toggleActivity('noActivity')}
        >
          Without activity in the last four weeks
        </CheckRow>
      </div>

      {/* Collapse lists toggle */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2.5">
        <span className="text-xs text-subtle">Collapse lists with no matching cards</span>
        <button
          type="button"
          role="switch"
          aria-checked={filters.collapseLists}
          onClick={() => set({ collapseLists: !filters.collapseLists })}
          className={`relative h-5 w-9 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
            filters.collapseLists ? 'bg-primary' : 'bg-border'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              filters.collapseLists ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
