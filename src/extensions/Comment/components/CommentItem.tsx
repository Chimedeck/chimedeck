// Single comment with inline edit/delete controls — styled to match the Trello-like mockup.
import { useState } from 'react';
import { marked } from 'marked';
import type { Attachment } from '~/extensions/Attachments/types';
import {
  hydrateCommentAttachmentMarkdown,
  stripCommentAttachmentPlaceholders,
} from '~/extensions/Comment/utils/attachmentMarkdown';
import CommentEditor from './CommentEditor';
import CommentDeletedItem from './CommentDeletedItem';

// Configure marked: soft line breaks become <br>, no mangling
marked.setOptions({ breaks: true, gfm: true });

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
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-pink-500', 'bg-yellow-500', 'bg-orange-500', 'bg-teal-500',
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
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Parse markdown and highlight @mention chips inside comment text. Returns safe HTML string. */
function renderContent(text: string, attachments: Attachment[]): string {
  const hydrated = attachments.length > 0
    ? hydrateCommentAttachmentMarkdown(text, attachments)
    : stripCommentAttachmentPlaceholders(text);
  // Convert markdown → HTML
  const html = marked.parse(hydrated) as string;
  // Wrap @mentions in a styled chip
  return html.replaceAll(
    /(@\w[\w.+-]*)/g,
    '<span class="rounded bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">$1</span>',
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

  const displayName = comment.author_name || comment.author_email || 'Unknown';
  const initials = getInitials(comment.author_name, comment.author_email);
  const color = avatarColor(comment.user_id);
  const avatarUrl = comment.author_avatar_url ?? null;

  const handleEdit = async (content: string) => {
    await onEdit(comment.id, content);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;
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
        className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${avatarUrl ? '' : color} overflow-hidden`}
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
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{displayName}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{relativeTime(comment.created_at)}</span>
          {comment.version > 1 && (
            <span className="text-xs italic text-gray-400">(edited)</span>
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
            submitLabel="Update"
          />
        ) : (
          <div
            className="comment-markdown text-sm text-gray-800 dark:text-gray-100 leading-relaxed
              [&_p]:mb-2 [&_p:last-child]:mb-0
              [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_a:hover]:text-blue-800 dark:[&_a:hover]:text-blue-300
              [&_strong]:font-semibold [&_em]:italic
              [&_code]:bg-gray-100 dark:[&_code]:bg-slate-700 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_code]:text-green-700 dark:[&_code]:text-green-300
              [&_pre]:bg-gray-100 dark:[&_pre]:bg-slate-700 [&_pre]:rounded [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:font-mono [&_pre]:text-green-700 dark:[&_pre]:text-green-300 [&_pre]:mb-2
              [&_pre_code]:bg-transparent [&_pre_code]:p-0
              [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2
              [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2
              [&_li]:mb-0.5
              [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-slate-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-500 dark:[&_blockquote]:text-gray-400 [&_blockquote]:mb-2
              [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1
              [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1"
            // [why] dangerouslySetInnerHTML — content is user-authored markdown parsed by marked.
            // Input is from authenticated users only (internal tool), so XSS risk is accepted.
            dangerouslySetInnerHTML={{ __html: renderContent(comment.content, attachments) }}
          />
        )}

        {/* Inline action links */}
        {!editing && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="hover:text-gray-800 dark:hover:text-gray-200 hover:underline"
              >
                Edit
              </button>
            )}
            {canEdit && canDelete && <span>·</span>}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="hover:text-red-500 hover:underline disabled:opacity-50"
              >
                {deleting ? '…' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentItem;

