// Timeline of activity events for a card or board.
import ActivityItem, { type Activity } from './ActivityItem';
import translations from '../translations/en.json';

interface Props {
  activities: Activity[];
  actorNames?: Record<string, string>; // actor_id → display name
  hasMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  /** When provided, card titles in archive events become clickable links. */
  boardId?: string;
}

const ActivityFeed = ({ activities, actorNames = {}, hasMore = false, onLoadMore, loading = false, boardId }: Props) => {
  return (
    <div className="flex flex-col">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted">{translations['activity.section.title']}</h3>

      {activities.length === 0 && !loading && (
        <p className="text-sm italic text-muted">{translations['activity.empty']}</p>
      )}

      <div className="divide-y divide-border">
        {activities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            actorName={actorNames[activity.actor_id]}
            {...(boardId ? { boardId } : {})}
          />
        ))}
      </div>

      {loading && (
        <p className="mt-2 text-xs text-muted">{translations['activity.loading']}</p>
      )}

      {hasMore && !loading && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="mt-2 rounded px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
        >
          {translations['activity.loadMore']}
        </button>
      )}
    </div>
  );
};

export default ActivityFeed;
