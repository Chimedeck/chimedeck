// Single comment with inline edit/delete controls
import { useState } from 'react';
import { marked } from 'marked';
import emojiData from '@emoji-mart/data';
import type { Attachment } from '~/extensions/Attachments/types';
import {
  hydrateCommentAttachmentMarkdown,
  stripCommentAttachmentPlaceholders,
} from '~/extensions/Comment/utils/attachmentMarkdown';
import CommentEditor from './CommentEditor';
import CommentDeletedItem from './CommentDeletedItem';
import translations from '../translations/en.json';

// Configure marked: soft line breaks become <br>, no mangling
marked.setOptions({ breaks: true, gfm: true });

// Build once so shortcode replacement is O(1) per token during render.
const SHORTCODE_TO_NATIVE = (() => {
  const map = new Map<string, string>();
  const emojis = emojiData.emojis as Record<string, { skins?: Array<{ native?: string }> }>;
  const aliases = (emojiData.aliases ?? {}) as Record<string, string>;

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
  return text.replace(/:([a-z0-9_+-]+):/gi, (full, shortcode: string) => {
    return SHORTCODE_TO_NATIVE.get(shortcode.toLowerCase()) ?? full;
  });
}

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  version: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
  // Author info returned from server (joined with users table)
  author_name?: string | null;
  author_email?: string | null;
  author_avatar_url?: string | null;
}

interface Props {
  comment: Comment;
  boardId?: string;
  attachments?: Attachment[];
  currentUserId: string;
  isAdmin?: boolean;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

/** Generate initials from a display name or email. */
function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = name || email || '?';
  const parts = source.split(/[\s@.]/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** Consistent avatar colour based on user id. */
// Darker shades guarantee sufficient contrast against text-inverse (white in light mode)
const AVATAR_COLORS = [
  'bg-blue-600', 'bg-green-700', 'bg-purple-600',
  'bg-pink-600', 'bg-amber-700', 'bg-orange-700', 'bg-teal-700',
];
function avatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = Math.trunc(hash * 31 + (userId.codePointAt(i) ?? 0));
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function buildBoardProps(boardId?: string): { boardId: string } | Record<string, never> {
  return boardId ? { boardId } : {};
}

/** Render a relative time string. */
function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return translations['comment.relativeTime.justNow'];
  if (diff < 3600) return `${Math.floor(diff / 60)} ${translations['comment.relativeTime.minAgo']}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${translations['comment.relativeTime.hrAgo']}`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Parse markdown and highlight @mention chips inside comment text. Returns safe HTML string. */
function renderContent(text: string, attachments: Attachment[]): string {
  const hydrated = attachments.length > 0
    ? hydrateCommentAttachmentMarkdown(text, attachments)
    : stripCommentAttachmentPlaceholders(text);
  const withNativeEmoji = replaceEmojiShortcodes(hydrated);
  // [why] Legacy/server-sanitized comments may store blockquote markers as
  // "&gt;". Convert marker positions back to markdown so rendering matches editor.
  const normalized = withNativeEmoji.replaceAll(/^(\s*)&gt;(?=\s|$)/gm, '$1>');
  // Convert markdown → HTML
  const html = marked.parse(normalized) as string;
  // Wrap @mentions in a styled chip
  return html.replaceAll(
    /(@\w[\w.+-]*)/g,
    '<span class="rounded bg-blue-100 px-1 py-0.5 text-xs font-medium text-blue-700">$1</span>',
  );
}

const CommentItem = ({ comment, boardId, attachments = [], currentUserId, isAdmin = false, onEdit, onDelete }: Props) => {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (comment.deleted) {
    return <CommentDeletedItem commentId={comment.id} createdAt={comment.created_at} />;
  }

  const isOwner = comment.user_id === currentUserId;
  const canEdit = isOwner;
  const canDelete = isOwner || isAdmin;

  const displayName = comment.author_name || comment.author_email || translations['comment.author.unknown'];
  const initials = getInitials(comment.author_name, comment.author_email);
  const color = avatarColor(comment.user_id);
  const avatarUrl = comment.author_avatar_url ?? null;

  const handleEdit = async (content: string) => {
    await onEdit(comment.id, content);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(translations['comment.confirm.delete'])) return;
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div
        className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${avatarUrl ? '' : color} overflow-hidden`} // [theme-exception] text-white on colored avatar
        title={displayName}
      >
        {avatarUrl
          ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover rounded-full" />
          : initials
        }
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Header: name + timestamp */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-base">{displayName}</span>
          <span className="text-xs text-muted">{relativeTime(comment.created_at)}</span>
          {comment.version > 1 && (
            <span className="text-xs italic text-muted">{translations['comment.edited']}</span>
          )}
        </div>

        {/* Comment text or editor */}
        {editing ? (
          <CommentEditor
            {...buildBoardProps(boardId)}
            cardId={comment.card_id}
            availableAttachments={attachments}
            initialValue={comment.content}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            submitLabel={translations['comment.editor.update']}
          />
        ) : (
          <div className="border border-border rounded-md px-3 py-2 bg-surface">
            <div
              className="comment-markdown prose prose-sm dark:prose-invert max-w-none text-base
                [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              // [why] dangerouslySetInnerHTML — content is user-authored markdown parsed by marked.
              // Input is from authenticated users only (internal tool), so XSS risk is accepted.
              dangerouslySetInnerHTML={{ __html: renderContent(comment.content, attachments) }}
            />
          </div>
        )}

        {/* Inline action links */}
        {!editing && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted">
            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="hover:text-subtle hover:underline"
              >
                {translations['comment.action.edit']}
              </button>
            )}
            {canEdit && canDelete && <span>·</span>}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="hover:text-danger hover:underline disabled:opacity-50"
              >
                {deleting ? translations['comment.action.deleting'] : translations['comment.action.delete']}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentItem;

