// Single comment with inline edit/delete controls.
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
}

interface Props {
  comment: Comment;
  currentUserId: string;
  isAdmin?: boolean;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
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
    <div className="flex flex-col gap-1 rounded border border-gray-100 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {new Date(comment.created_at).toLocaleString()}
          {comment.version > 1 && (
            <span className="ml-1 italic">(edited v{comment.version})</span>
          )}
        </span>
        <div className="flex gap-1">
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
              aria-label="Edit comment"
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
              aria-label="Delete comment"
            >
              {deleting ? '…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <CommentEditor
          initialValue={comment.content}
          onSubmit={handleEdit}
          onCancel={() => setEditing(false)}
          submitLabel="Update"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-gray-800">{comment.content}</p>
      )}
    </div>
  );
};

export default CommentItem;
