// Threaded list of comments for a card.
import CommentItem, { type Comment } from './CommentItem';
import CommentEditor from './CommentEditor';
import translations from '../translations/en.json';

interface Props {
  boardId?: string;
  comments: Comment[];
  currentUserId: string;
  isAdmin?: boolean;
  onAddComment: (content: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<void>;
  onRemoveReaction?: (commentId: string, emoji: string) => Promise<void>;
  onAddReply?: (parentId: string, content: string) => Promise<void>;
  onEditReply?: (commentId: string, content: string) => Promise<void>;
  onDeleteReply?: (commentId: string) => Promise<void>;
  cardId?: string;
}

const CommentThread = ({
  boardId,
  comments,
  currentUserId,
  isAdmin = false,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onAddReaction,
  onRemoveReaction,
  onAddReply,
  onEditReply,
  onDeleteReply,
  cardId,
}: Props) => {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase text-muted">{translations['comment.section.title']}</h3>

      <div className="flex flex-col gap-4">
        {comments.length === 0 && (
          <p className="text-sm text-muted italic">{translations['comment.empty']}</p>
        )}
        {comments.filter(Boolean).map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            {...(boardId !== undefined ? { boardId } : {})}
            {...(cardId !== undefined ? { cardId } : {})}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onEdit={onEditComment}
            onDelete={onDeleteComment}
            {...(onAddReaction ? { onAddReaction } : {})}
            {...(onRemoveReaction ? { onRemoveReaction } : {})}
            {...(onAddReply ? { onAddReply } : {})}
            {...(onEditReply ? { onEditReply } : {})}
            {...(onDeleteReply ? { onDeleteReply } : {})}
          />
        ))}
      </div>

      <CommentEditor
        {...(boardId !== undefined ? { boardId } : {})}
        placeholder={translations['comment.placeholder']}
        onSubmit={onAddComment}
        submitLabel={translations['comment.submit']}
      />
    </div>
  );
};

export default CommentThread;
