// Threaded list of comments for a card.
import CommentItem, { type Comment } from './CommentItem';
import CommentEditor from './CommentEditor';

interface Props {
  comments: Comment[];
  currentUserId: string;
  isAdmin?: boolean;
  onAddComment: (content: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

const CommentThread = ({
  comments,
  currentUserId,
  isAdmin = false,
  onAddComment,
  onEditComment,
  onDeleteComment,
}: Props) => {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase text-gray-500">Comments</h3>

      <div className="flex flex-col gap-2">
        {comments.length === 0 && (
          <p className="text-sm text-gray-400 italic">No comments yet.</p>
        )}
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onEdit={onEditComment}
            onDelete={onDeleteComment}
          />
        ))}
      </div>

      <CommentEditor
        placeholder="Add a comment…"
        onSubmit={onAddComment}
        submitLabel="Comment"
      />
    </div>
  );
};

export default CommentThread;
