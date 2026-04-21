// ChecklistItem — single checklist row with toggle, rename, assign, due date, and convert actions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import emojiData from '@emoji-mart/data';
import {
  ArrowTopRightOnSquareIcon,
  Bars2Icon,
  CheckIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import type { ChecklistItem as ChecklistItemType } from '../api';
import type { Attachment } from '../../Attachments/types';
import {
  ImageLightbox,
  VideoLightbox,
  PdfLightbox,
} from '../../Attachments/components/AttachmentThumbnail';

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

function renderChecklistTitle(text: string, attachments: Attachment[] = []): string {
  const raw = marked.parseInline(replaceEmojiShortcodes(text)) as string;
  // Replace attachment: placeholder links with data-attachment-id anchors for click-to-preview
  const withAttachments = processAttachmentLinks(raw, attachments);
  // Add target="_blank" to all remaining external links
  return addLinkTargetBlank(withAttachments);
}

/** Classify attachment MIME type for preview routing. */
function getAttachmentMediaType(contentType: string | null): 'image' | 'video' | 'pdf' | 'other' {
  if (!contentType) return 'other';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType === 'application/pdf') return 'pdf';
  return 'other';
}

/**
 * Convert `<a href="attachment:encoded-name">` links produced by marked into
 * `<a data-attachment-id="...">` anchors so clicks can open a preview lightbox.
 * Non-previewable attachments fall through to a plain new-tab link.
 */
function processAttachmentLinks(html: string, attachments: Attachment[]): string {
  if (!html.includes('attachment:') || attachments.length === 0) return html;
  const byName = new Map(attachments.map((a) => [a.name, a]));
  return html.replaceAll(
    /<a\b([^>]*?)\bhref="attachment:([^"]*?)"([^>]*)>([\s\S]*?)<\/a>/gi,
    (_full: string, _before: string, encoded: string, _after: string, inner: string): string => {
      let name: string;
      try { name = decodeURIComponent(encoded); } catch { name = encoded; }
      const att = byName.get(name);
      if (att?.status !== 'READY') {
        // [why] Attachment deleted or not yet scanned — render as struck-through text so the
        // item title is still readable without a dangling broken link.
        return `<span class="line-through text-muted" title="Attachment not found">${inner}</span>`;
      }
      const mediaType = getAttachmentMediaType(att.content_type);
      if (mediaType === 'other') {
        // Non-previewable file — open the proxy view URL in a new tab
        const href = att.view_url ?? '#';
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="underline decoration-dotted underline-offset-2">${inner}</a>`;
      }
      return `<a data-attachment-id="${att.id}" data-attachment-type="${mediaType}" href="#" class="underline decoration-dotted underline-offset-2 cursor-pointer">${inner}</a>`;
    },
  );
}

/**
 * Add target="_blank" rel="noopener noreferrer" to external links that don't already
 * have a target and whose href is not a bare anchor (#...).
 */
function addLinkTargetBlank(html: string): string {
  return html.replaceAll(
    /<a(?=[^>]*\bhref="(?!#))(?![^>]*\btarget=)/gi,
    '<a target="_blank" rel="noopener noreferrer"',
  );
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
  // [why] Renders a cosmetic Bars2Icon grip so users know the row is draggable.
  // Actual drag is on the whole SortableChecklistItemRow — only the edit input
  // stops pointer propagation to prevent dnd-kit from intercepting text selection.
  showDragHandle?: boolean;
  disabled?: boolean;
  /** Card attachments — when provided, attachment: links in titles open a preview lightbox. */
  attachments?: Attachment[];
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
  showDragHandle,
  disabled,
  attachments = [],
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [converting, setConverting] = useState(false);
  const [failedAvatarIds, setFailedAvatarIds] = useState<Set<string>>(new Set());
  // Preview state for attachment links embedded in the checklist title
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const currentDueDate = item.due_date ? new Date(item.due_date) : null;
  const [dueDateInput, setDueDateInput] = useState(currentDueDate ? toDateInputValue(currentDueDate) : '');
  const [dueTimeInput, setDueTimeInput] = useState(currentDueDate ? toTimeInputValue(currentDueDate) : '12:00');

  const rootRef = useRef<HTMLDivElement>(null);
  const renderedTitle = useMemo(() => renderChecklistTitle(item.title, attachments), [item.title, attachments]);

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
    <>
    <div ref={rootRef} className="group relative flex min-w-0 items-start gap-2 py-1">
      {showDragHandle && !disabled && (
        // [why] Cosmetic grip icon — drag activates from the entire SortableChecklistItemRow
        // wrapper div. The icon tells users the row is draggable without being the sole
        // drag target, so drag works from anywhere on the row.
        <span
          className="mt-0.5 shrink-0 cursor-grab text-muted opacity-0 group-hover:opacity-100"
          aria-hidden="true"
        >
          <Bars2Icon className="h-3.5 w-3.5" />
        </span>
      )}
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
          // [why] Stop pointer propagation so dnd-kit's row-level listener doesn't
          // capture the pointer-down and turn text selection into an item drag.
          onPointerDown={(e) => { e.stopPropagation(); }}
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
            disabled={disabled}
            aria-label={`Edit: ${item.title}`}
            // [why] Render markdown + emoji shortcodes in checklist text for parity with comments.
            // The div intercepts link clicks: attachment links open the preview lightbox;
            // external links open in a new tab via window.open (reliable inside a button);
            // unhandled clicks activate edit mode.
            dangerouslySetInnerHTML={{ __html: renderedTitle }}
            onClick={(e) => {
              if (disabled) return;
              const link = (e.target as HTMLElement).closest('a');
              if (link instanceof HTMLAnchorElement) {
                const attachmentId = link.dataset.attachmentId;
                if (attachmentId) {
                  e.preventDefault();
                  const att = attachments.find((a) => a.id === attachmentId);
                  if (att) setPreviewAttachment(att);
                } else {
                  // Regular external link — open in new tab; prevent default to avoid issues
                  // with <a> inside <button> behaviour across browsers.
                  const href = link.getAttribute('href');
                  if (href && href !== '#') {
                    e.preventDefault();
                    window.open(href, '_blank', 'noopener,noreferrer');
                  }
                }
                return; // Don't activate edit mode when any link is clicked
              }
              setEditing(true);
            }}
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
    {/* Attachment preview lightbox — rendered outside the row div so it overlays the full screen */}
    {previewAttachment?.status === 'READY' && (() => {
      const mediaType = getAttachmentMediaType(previewAttachment.content_type);
      const src = previewAttachment.view_url ?? '';
      const name = previewAttachment.alias ?? previewAttachment.name;
      const close = () => { setPreviewAttachment(null); };
      if (!src) return null;
      if (mediaType === 'image') return <ImageLightbox src={src} name={name} onClose={close} />;
      if (mediaType === 'video') return <VideoLightbox src={src} name={name} onClose={close} />;
      if (mediaType === 'pdf') return <PdfLightbox src={src} name={name} onClose={close} />;
      return null;
    })()}
  </>
  );
};
