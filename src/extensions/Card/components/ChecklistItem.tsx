// ChecklistItem — single checklist row with toggle, rename, assign, due date, and convert actions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import emojiData from '@emoji-mart/data';
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import type { ChecklistItem as ChecklistItemType } from '../api';

marked.setOptions({ breaks: true, gfm: true });

const SHORTCODE_TO_NATIVE = (() => {
  const map = new Map<string, string>();
  const dataset = emojiData as unknown as {
    emojis: Record<string, { skins?: Array<{ native?: string }> }>;
    aliases?: Record<string, string>;
  };
  const emojis = dataset.emojis;
  const aliases = dataset.aliases ?? {};

  for (const [shortcode, value] of Object.entries(emojis)) {
    const native = value.skins?.[0]?.native;
    if (!native) continue;
    map.set(shortcode.toLowerCase(), native);
  }

  for (const [alias, canonical] of Object.entries(aliases)) {
    const native = emojis[canonical]?.skins?.[0]?.native;
    if (!native) continue;
    map.set(alias.toLowerCase(), native);
  }

  return map;
})();

function replaceEmojiShortcodes(text: string): string {
  return text.replaceAll(/:([a-z0-9_+-]+):/gi, (full, shortcode: string) => {
    return SHORTCODE_TO_NATIVE.get(shortcode.toLowerCase()) ?? full;
  });
}

function renderChecklistTitle(text: string): string {
  return marked.parseInline(replaceEmojiShortcodes(text)) as string;
}

interface Props {
  item: ChecklistItemType;
  boardMembers: Array<{ id: string; email: string; name: string | null; avatar_url?: string | null }>;
  onToggle: (itemId: string, checked: boolean) => Promise<void>;
  onRename: (itemId: string, title: string) => Promise<void>;
  onAssign: (itemId: string, memberId: string | null) => Promise<void>;
  onDueDateChange: (itemId: string, dueDate: string | null) => Promise<void>;
  onConvertToCard: (itemId: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  disabled?: boolean;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function formatDueDateLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getMemberInitials(name: string | null, email: string): string {
  const source = name ?? email;
  return source
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function openNativePicker(input: HTMLInputElement): void {
  const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
  if (typeof pickerInput.showPicker === 'function') {
    pickerInput.showPicker();
  }
}

export const ChecklistItem = ({
  item,
  boardMembers,
  onToggle,
  onRename,
  onAssign,
  onDueDateChange,
  onConvertToCard,
  onDelete,
  disabled,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [converting, setConverting] = useState(false);
  const [failedAvatarIds, setFailedAvatarIds] = useState<Set<string>>(new Set());

  const currentDueDate = item.due_date ? new Date(item.due_date) : null;
  const [dueDateInput, setDueDateInput] = useState(currentDueDate ? toDateInputValue(currentDueDate) : '');
  const [dueTimeInput, setDueTimeInput] = useState(currentDueDate ? toTimeInputValue(currentDueDate) : '12:00');

  const rootRef = useRef<HTMLDivElement>(null);
  const renderedTitle = useMemo(() => renderChecklistTitle(item.title), [item.title]);

  useEffect(() => {
    if (!dueOpen) return;
    const dueDate = item.due_date ? new Date(item.due_date) : null;
    setDueDateInput(dueDate ? toDateInputValue(dueDate) : '');
    setDueTimeInput(dueDate ? toTimeInputValue(dueDate) : '12:00');
  }, [dueOpen, item.due_date]);

  useEffect(() => {
    if (!menuOpen && !assignOpen && !dueOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setAssignOpen(false);
        setDueOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setAssignOpen(false);
        setDueOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, assignOpen, dueOpen]);

  const assignedMember = useMemo(
    () => boardMembers.find((member) => member.id === item.assigned_member_id) ?? null,
    [boardMembers, item.assigned_member_id],
  );

  const isAvatarFailed = (memberId: string): boolean => failedAvatarIds.has(memberId);

  const markAvatarFailed = (memberId: string) => {
    setFailedAvatarIds((previous) => {
      if (previous.has(memberId)) return previous;
      const next = new Set(previous);
      next.add(memberId);
      return next;
    });
  };

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return boardMembers;
    return boardMembers.filter((member) => {
      const name = member.name?.toLowerCase() ?? '';
      return name.includes(q) || member.email.toLowerCase().includes(q);
    });
  }, [boardMembers, memberQuery]);

  let convertActionLabel = 'Convert to card';
  if (item.linked_card_id) convertActionLabel = 'Already converted';
  else if (converting) convertActionLabel = 'Converting...';

  const submitRename = async () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      await onRename(item.id, trimmed);
    } else {
      setTitle(item.title);
    }
    setEditing(false);
  };

  const handleDueSave = async () => {
    if (!dueDateInput) return;
    const [year, month, day] = dueDateInput.split('-').map(Number);
    const [hourRaw, minuteRaw] = (dueTimeInput || '12:00').split(':').map(Number);
    if (!year || !month || !day) return;
    const hour = Number.isFinite(hourRaw) ? hourRaw : 12;
    const minute = Number.isFinite(minuteRaw) ? minuteRaw : 0;
    const nextDueDate = new Date(year, month - 1, day, hour, minute);
    await onDueDateChange(item.id, nextDueDate.toISOString());
    setDueOpen(false);
  };

  const handleConvertToCard = async () => {
    setConverting(true);
    try {
      await onConvertToCard(item.id);
      setMenuOpen(false);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div ref={rootRef} className="group relative flex min-w-0 items-start gap-2 py-1">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-border-strong text-blue-500 bg-bg-surface"
        aria-label={`Toggle: ${item.title}`}
      />
      {editing ? (
        <input
          className="min-w-0 flex-1 rounded border border-border bg-bg-overlay px-1 py-0.5 text-sm text-base focus:outline-none focus:ring-1 focus:ring-primary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') submitRename();
            if (e.key === 'Escape') {
              setTitle(item.title);
              setEditing(false);
            }
          }}
          autoFocus
        />
      ) : (
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className={`min-w-0 w-full cursor-text whitespace-normal break-words bg-transparent p-0 text-left text-sm [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-2 ${item.checked ? 'text-muted line-through' : 'text-base'}`}
            onClick={() => !disabled && setEditing(true)}
            disabled={disabled}
            aria-label={`Edit: ${item.title}`}
            // [why] Render markdown + emoji shortcodes in checklist text for parity with comments.
            dangerouslySetInnerHTML={{ __html: renderedTitle }}
          />
          {(item.due_date || assignedMember) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {item.due_date && (
                <span className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[11px] text-subtle">
                  <ClockIcon className="h-3 w-3" aria-hidden="true" />
                  {formatDueDateLabel(item.due_date)}
                </span>
              )}
              {assignedMember && (
                <span className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[11px] text-subtle">
                  {assignedMember.avatar_url && !isAvatarFailed(assignedMember.id) ? (
                    <img
                      src={assignedMember.avatar_url}
                      alt={assignedMember.name ?? assignedMember.email}
                      className="h-4 w-4 rounded-full object-cover"
                      onError={() => {
                        markAvatarFailed(assignedMember.id);
                      }}
                    />
                  ) : (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-bg-overlay text-[10px] font-semibold text-base">
                      {getMemberInitials(assignedMember.name, assignedMember.email)}
                    </span>
                  )}
                  {assignedMember.name ?? assignedMember.email}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {!disabled && (
        <div className="relative flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
          <button
            type="button"
            className={`rounded p-1.5 text-muted hover:bg-bg-overlay hover:text-base ${dueOpen ? 'bg-bg-overlay text-base' : ''}`}
            onClick={() => {
              setDueOpen((open) => !open);
              setAssignOpen(false);
              setMenuOpen(false);
            }}
            aria-label={`Set due date for ${item.title}`}
          >
            <ClockIcon className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            className={`rounded p-1.5 text-muted hover:bg-bg-overlay hover:text-base ${assignOpen ? 'bg-bg-overlay text-base' : ''}`}
            onClick={() => {
              setAssignOpen((open) => !open);
              setDueOpen(false);
              setMenuOpen(false);
              setMemberQuery('');
            }}
            aria-label={`Assign member to ${item.title}`}
          >
            <UserPlusIcon className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            className={`rounded p-1.5 text-muted hover:bg-bg-overlay hover:text-base ${menuOpen ? 'bg-bg-overlay text-base' : ''}`}
            onClick={() => {
              setMenuOpen((open) => !open);
              setAssignOpen(false);
              setDueOpen(false);
            }}
            aria-label={`Item actions for ${item.title}`}
          >
            <EllipsisHorizontalIcon className="h-4 w-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-bg-surface py-1 shadow-2xl">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-base hover:bg-bg-overlay disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void handleConvertToCard()}
                disabled={converting || Boolean(item.linked_card_id)}
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
                {convertActionLabel}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-danger hover:bg-bg-overlay"
                onClick={() => {
                  void onDelete(item.id);
                  setMenuOpen(false);
                }}
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            </div>
          )}

          {assignOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-border bg-bg-surface p-2.5 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-base">Assign</p>
                <button
                  type="button"
                  className="rounded p-1 text-subtle hover:bg-bg-overlay hover:text-base"
                  onClick={() => setAssignOpen(false)}
                  aria-label="Close assign popover"
                >
                  <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <input
                type="text"
                className="mb-2 w-full rounded border border-border bg-bg-overlay px-2 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Search members"
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
              />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-base hover:bg-bg-overlay"
                  onClick={() => {
                    void onAssign(item.id, null);
                    setAssignOpen(false);
                  }}
                >
                  <span>Unassign</span>
                  {!item.assigned_member_id && <CheckIcon className="h-4 w-4 text-emerald-500" aria-hidden="true" />}
                </button>
                {filteredMembers.map((member) => {
                  const isSelected = member.id === item.assigned_member_id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-base hover:bg-bg-overlay"
                      onClick={() => {
                        void onAssign(item.id, isSelected ? null : member.id);
                        setAssignOpen(false);
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {member.avatar_url && !isAvatarFailed(member.id) ? (
                          <img
                            src={member.avatar_url}
                            alt={member.name ?? member.email}
                            className="h-6 w-6 rounded-full object-cover"
                            onError={() => {
                              markAvatarFailed(member.id);
                            }}
                          />
                        ) : (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg-overlay text-xs font-semibold text-base">
                            {getMemberInitials(member.name, member.email)}
                          </span>
                        )}
                        <span className="truncate">{member.name ?? member.email}</span>
                      </span>
                      {isSelected && <CheckIcon className="h-4 w-4 text-emerald-500" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {dueOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-border bg-bg-surface p-3 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-base">Change due date</p>
                <button
                  type="button"
                  className="rounded p-1 text-subtle hover:bg-bg-overlay hover:text-base"
                  onClick={() => setDueOpen(false)}
                  aria-label="Close due date popover"
                >
                  <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label htmlFor={`checklist-item-due-date-${item.id}`} className="mb-1 block text-xs font-medium text-muted">Due date</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      id={`checklist-item-due-date-${item.id}`}
                      type="date"
                      value={dueDateInput}
                      onChange={(event) => setDueDateInput(event.target.value)}
                      onFocus={(event) => {
                        openNativePicker(event.currentTarget);
                      }}
                      onClick={(event) => {
                        openNativePicker(event.currentTarget);
                      }}
                      style={{ color: 'var(--text-base)' }}
                      className="rounded border border-border bg-bg-overlay px-2 py-1.5 text-sm text-base [color-scheme:light] focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="time"
                      value={dueTimeInput}
                      onChange={(event) => setDueTimeInput(event.target.value)}
                      onFocus={(event) => {
                        openNativePicker(event.currentTarget);
                      }}
                      onClick={(event) => {
                        openNativePicker(event.currentTarget);
                      }}
                      style={{ color: 'var(--text-base)' }}
                      className="rounded border border-border bg-bg-overlay px-2 py-1.5 text-sm text-base [color-scheme:light] focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  onClick={() => void handleDueSave()}
                  disabled={!dueDateInput}
                >
                  Save
                </Button>
                {item.due_date && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      void onDueDateChange(item.id, null);
                      setDueOpen(false);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
