// BoardActivityPanel — paginated activity feed scoped to a single board.
import { useEffect, useState, useCallback } from 'react';
import { getBoardActivity } from './api';
import type { BoardActivityEntry } from './types';
import ActivityFeed from '~/extensions/Activity/components/ActivityFeed';
import type { Activity } from '~/extensions/Activity/components/ActivityItem';
import translations from './translations/en.json';

interface Props {
  boardId: string;
}
// Map server-shaped entry to ActivityItem's Activity interface
function toActivity(entry: BoardActivityEntry): Activity {
  return {
    id: entry.id,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    board_id: entry.board_id,
    action: entry.action,
    actor_id: entry.actor_id,
    payload: entry.payload,
    created_at: entry.created_at,
  };
}

const BoardActivityPanel = ({ boardId }: Props) => {
  const [activities, setActivities] = useState<BoardActivityEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextCursor: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getBoardActivity({ boardId, cursor: nextCursor });
        setActivities((prev) => (nextCursor ? [...prev, ...res.data] : res.data));
        setCursor(res.metadata.cursor);
        setHasMore(res.metadata.hasMore);
      } catch {
        setError(translations['BoardViews.errorLoadActivity']);
      } finally {
        setLoading(false);
      }
    },
    [boardId],
  );

  useEffect(() => {
    loadPage(null);
  }, [loadPage]);

  const actorNames: Record<string, string> = {};
  for (const entry of activities) {
    if (entry.actor_name) actorNames[entry.actor_id] = entry.actor_name;
  }

  if (error) {
    return <p className="p-4 text-sm text-danger">{error}</p>;
  }

  return (
    <div className="p-4">
      <ActivityFeed
        activities={activities.map(toActivity)}
        actorNames={actorNames}
        hasMore={hasMore}
        loading={loading}
        onLoadMore={() => loadPage(cursor)}
        boardId={boardId}
      />
    </div>
  );
};

export default BoardActivityPanel;
