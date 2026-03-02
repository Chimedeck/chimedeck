// Renders a "[deleted]" placeholder for soft-deleted comments.
interface Props {
  commentId: string;
  createdAt: string;
}

const CommentDeletedItem = ({ commentId, createdAt }: Props) => {
  return (
    <div
      key={commentId}
      className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm italic text-gray-400"
      aria-label="Deleted comment"
    >
      [deleted] &middot; <span className="text-xs">{new Date(createdAt).toLocaleString()}</span>
    </div>
  );
};

export default CommentDeletedItem;
