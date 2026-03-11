// Timeline of activity events for a card or board.
import ActivityItem, { type Activity } from './ActivityItem';

interface Props {
  activities: Activity[];
  actorNames?: Record<string, string>; // actor_id → display name
  hasMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
}

const ActivityFeed = ({ activities, actorNames = {}, hasMore = false, onLoadMore, loading = false }: Props) => {
  return (
    <div className="flex flex-col">
      <h3 className="mb-2 text-xs font-semibold uppercase text-gray-400">Activity</h3>

      {activities.length === 0 && !loading && (
        <p className="text-sm italic text-gray-400">No activity yet.</p>
      )}

      <div className="divide-y divide-gray-700">
        {activities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            actorName={actorNames[activity.actor_id]}
          />
        ))}
      </div>

      {loading && (
        <p className="mt-2 text-xs text-gray-400">Loading…</p>
      )}

      {hasMore && !loading && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="mt-2 rounded px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
        >
          Load more
        </button>
      )}
    </div>
  );
};

export default ActivityFeed;
