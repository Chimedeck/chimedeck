// Single comment with inline edit/delete controls — styled to match the Trello-like mockup.
import { useState } from 'react';
import CommentEditor from './CommentEditor';
import CommentDeletedItem from './CommentDeletedItem';

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
}

interface Props {
  comment: Comment;
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
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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

/** Highlight @mention chips inside comment text. */
function renderContent(text: string) {
  const parts = text.split(/(@\w[\w.+-]*)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="rounded bg-blue-100 px-1 py-0.5 text-xs font-medium text-blue-700">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const CommentItem = ({ comment, currentUserId, isAdmin = false, onEdit, onDelete }: Props) => {
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
        className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${color}`}
        title={displayName}
      >
        {initials}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Header: name + timestamp */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-900">{displayName}</span>
          <span className="text-xs text-gray-400">{relativeTime(comment.created_at)}</span>
          {comment.version > 1 && (
            <span className="text-xs italic text-gray-400">(edited)</span>
          )}
        </div>

        {/* Comment text or editor */}
        {editing ? (
          <CommentEditor
            initialValue={comment.content}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            submitLabel="Update"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
            {renderContent(comment.content)}
          </p>
        )}

        {/* Inline action links */}
        {!editing && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            {canEdit && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="hover:text-gray-600 hover:underline"
                >
                  Edit
                </button>
              </>
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

