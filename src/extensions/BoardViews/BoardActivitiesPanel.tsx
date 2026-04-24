// BoardActivitiesPanel — unified chronological timeline of activities and comments for a board.
// The server returns items pre-sorted by created_at DESC so the client renders them as-is.
import { useEffect, useState, useCallback } from 'react';
import { getBoardActivities } from './api';
import type { BoardTimelineItem } from './types';
import ActivityItem, { type Activity } from '~/extensions/Activity/components/ActivityItem';
import Button from '~/common/components/Button';
import translations from './translations/en.json';

interface Props {
  boardId: string;
  onCardClick?: (cardId: string) => void;
}

function toActivity(entry: BoardTimelineItem & { kind: 'activity' }): Activity {
  return {
    id: entry.data.id,
    entity_type: entry.data.entity_type,
    entity_id: entry.data.entity_id,
    board_id: entry.data.board_id,
    action: entry.data.action,
    actor_id: entry.data.actor_id,
    payload: entry.data.payload,
    created_at: entry.data.created_at,
  };
}

const BoardActivitiesPanel = ({ boardId, onCardClick }: Props) => {
  const [items, setItems] = useState<BoardTimelineItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextCursor: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getBoardActivities({ boardId, cursor: nextCursor });
        const payload = res as unknown as {
          data?: unknown;
          metadata?: { cursor?: string | null; hasMore?: boolean };
        };
        const rawItems = Array.isArray(payload.data)
          ? payload.data
          : (payload.data as { data?: unknown } | undefined)?.data;
        const pageItems = Array.isArray(rawItems) ? (rawItems as BoardTimelineItem[]) : [];

        setItems((prev) => (nextCursor ? [...prev, ...pageItems] : pageItems));
        setCursor(res.metadata.cursor);
        setHasMore(res.metadata.hasMore);
      } catch {
        setError(translations['BoardViews.errorLoadActivity']);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [boardId],
  );

  useEffect(() => {
    void loadPage(null);
  }, [loadPage]);

  const visibleItems = Array.isArray(items) ? items : [];

  if (error) {
    return <p className="p-4 text-sm text-danger">{error}</p>;
  }

  // Build actor name map for activity items
  const actorNames: Record<string, string> = {};
  for (const item of visibleItems) {
    if (item.kind === 'activity' && item.data.actor_name) {
      actorNames[item.data.actor_id] = item.data.actor_name;
    }
  }

  return (
    <div className="p-4">
      {visibleItems.length === 0 && !loading && (
        <p className="text-sm italic text-muted">No activity yet.</p>
      )}

      <div className="divide-y divide-border">
        {visibleItems.map((item) => {
          if (item.kind === 'activity') {
            return (
              <ActivityItem
                key={`activity-${item.data.id}`}
                activity={toActivity(item as BoardTimelineItem & { kind: 'activity' })}
                actorName={actorNames[item.data.actor_id]}
                boardId={boardId}
              />
            );
          }

          const comment = item.data;
          const authorName = comment.author_name ?? comment.author_email ?? 'Unknown';
          const commentCardTitle = comment.card_title ?? 'Untitled card';
          return (
            <div key={`comment-${comment.id}`} className="flex items-start gap-2 py-1.5 text-sm">
              <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
              <div className="flex-1">
                <span>
                  <span className="font-medium">{authorName}</span>
                  {' '}
                  {comment.deleted ? (
                    <span className="italic text-muted">deleted a comment on </span>
                  ) : (
                    <>commented on </>
                  )}
                  {onCardClick ? (
                    <button
                      type="button"
                      className="font-medium underline underline-offset-2 transition-opacity hover:opacity-75"
                      onClick={() => {
                        onCardClick(comment.card_id);
                      }}
                    >
                      {`"${commentCardTitle}"`}
                    </button>
                  ) : (
                    <span className="font-medium">{`"${commentCardTitle}"`}</span>
                  )}
                  {!comment.deleted && (
                    <span className="text-muted">: {comment.content}</span>
                  )}
                </span>
                <span className="ml-2 text-xs text-muted">
                  {new Date(comment.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {loading && <p className="mt-2 text-xs text-muted">{translations['BoardViews.loadingComments']}</p>}

      {hasMore && !loading && (
        <Button variant="link" size="sm" onClick={() => { void loadPage(cursor); }}>
          Load more
        </Button>
      )}
    </div>
  );
};

export default BoardActivitiesPanel;
