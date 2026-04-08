// Renders a "[deleted]" placeholder for soft-deleted comments.
import translations from '../translations/en.json';

interface Props {
  commentId: string;
  createdAt: string;
}

const CommentDeletedItem = ({ commentId, createdAt }: Props) => {
  return (
    <div
      key={commentId}
      className="rounded border border-border bg-bg-overlay px-3 py-2 text-sm italic text-muted" // [theme-exception] bg-bg-overlay has no dark-mode semantic equivalent — needs design input
      aria-label={translations['comment.deleted.ariaLabel']}
    >
      {translations['comment.deleted.text']} &middot; <span className="text-xs">{new Date(createdAt).toLocaleString()}</span>
    </div>
  );
};

export default CommentDeletedItem;
