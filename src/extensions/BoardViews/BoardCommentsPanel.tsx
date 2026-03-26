// BoardCommentsPanel — paginated list of all comments across cards in a board.
import { useEffect, useState, useCallback } from 'react';
import { getBoardComments } from './api';
import type { BoardComment } from './types';
import translations from './translations/en.json';

interface Props {
  boardId: string;
}

const BoardCommentsPanel = ({ boardId }: Props) => {
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextCursor: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getBoardComments({ boardId, cursor: nextCursor });
        setComments((prev) => (nextCursor ? [...prev, ...res.data] : res.data));
        setCursor(res.metadata.cursor);
        setHasMore(res.metadata.hasMore);
      } catch {
        setError(translations['BoardViews.errorLoadComments']);
      } finally {
        setLoading(false);
      }
    },
    [boardId],
  );

  useEffect(() => {
    loadPage(null);
  }, [loadPage]);

  if (error) {
    return <p className="p-4 text-sm text-danger">{error}</p>;
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase text-muted">{translations['BoardViews.commentsHeading']}</h3>

      {comments.length === 0 && !loading && (
        <p className="text-sm italic text-subtle">{translations['BoardViews.noComments']}</p>
      )}

      {comments.map((comment) => (
        <div
          key={comment.id}
          className="rounded border border-border bg-bg-surface p-3 text-sm"
        >
          <div className="mb-1 flex items-center justify-between text-xs text-subtle">
            <span className="font-medium text-subtle">
              {comment.author_name ?? comment.author_email ?? 'Unknown'}
            </span>
            <span className="ml-2 text-muted">{comment.card_title}</span>
            <span className="ml-auto">{new Date(comment.created_at).toLocaleString()}</span>
          </div>
          {comment.deleted ? (
            <p className="italic text-muted">This comment was deleted.</p>
          ) : (
            <p className="text-base whitespace-pre-wrap">{comment.content}</p>
          )}
        </div>
      ))}

      {loading && <p className="text-xs text-subtle">{translations['BoardViews.loadingComments']}</p>}

      {hasMore && !loading && (
        <button
          onClick={() => loadPage(cursor)}
          className="rounded px-3 py-1.5 text-xs text-link hover:bg-bg-overlay"
        >
          {translations['BoardViews.loadMoreComments']}
        </button>
      )}
    </div>
  );
};

export default BoardCommentsPanel;
