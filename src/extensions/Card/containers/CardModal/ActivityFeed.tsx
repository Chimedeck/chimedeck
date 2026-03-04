// ActivityFeed — unified timeline of comments and system activity events for a card.
// Renders comments as full bubbles and system events as compact single-line rows.
// Feed is sorted ascending by created_at (oldest first).
import CommentItem, { type Comment } from '~/extensions/Comment/components/CommentItem';
import CommentEditor from '~/extensions/Comment/components/CommentEditor';
import { getActivityEventMeta } from '../../config/activityEventLabels';
import { VISIBLE_ACTIVITY_EVENT_TYPES } from '../../config/activityEventsConfig';
import type { ActivityData } from '../../slices/cardDetailSlice';
import type { CommentData } from '../../api/cardDetail';

interface Props {
  boardId?: string;
  comments: CommentData[];
  activities: ActivityData[];
  currentUserId: string;
  onAddComment: (content: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

type FeedItem =
  | { kind: 'comment'; ts: string; comment: Comment }
  | { kind: 'event'; ts: string; activity: ActivityData };

/** Relative time helper */
function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ActivityFeed = ({
  boardId,
  comments,
  activities,
  currentUserId,
  onAddComment,
  onEditComment,
  onDeleteComment,
}: Props) => {
  // Convert comments to feed items
  const commentItems: FeedItem[] = comments
    .filter(Boolean)
    .map((c) => ({ kind: 'comment', ts: c.created_at, comment: c as Comment }));

  // Convert system activity events to feed items (exclude comment-type events)
  const eventItems: FeedItem[] = activities
    .filter((a) => VISIBLE_ACTIVITY_EVENT_TYPES.includes(a.action))
    .map((a) => ({ kind: 'event', ts: a.created_at, activity: a }));

  // Merge and sort ascending
  const feed: FeedItem[] = [...commentItems, ...eventItems].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase text-gray-500">Activity</h3>

      <div className="flex flex-col gap-3">
        {feed.length === 0 && (
          <p className="text-sm text-gray-400 italic">No activity yet.</p>
        )}

        {feed.map((item) => {
          if (item.kind === 'comment') {
            return (
              <CommentItem
                key={`comment-${item.comment.id}`}
                comment={item.comment}
                {...(boardId !== undefined ? { boardId } : {})}
                currentUserId={currentUserId}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
              />
            );
          }

          // System event row: dot + label + timestamp
          const { activity } = item;
          const meta = getActivityEventMeta(activity.action);
          return (
            <div
              key={`event-${activity.id}`}
              className="flex items-center gap-2 text-xs text-slate-500 py-0.5"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dotColor}`} />
              <span className="flex-1">{meta.label}</span>
              <span className="text-slate-600 flex-shrink-0">{relativeTime(activity.created_at)}</span>
            </div>
          );
        })}
      </div>

      <CommentEditor
        {...(boardId !== undefined ? { boardId } : {})}
        placeholder="Add a comment…"
        onSubmit={onAddComment}
        submitLabel="Comment"
      />
    </div>
  );
};

export default ActivityFeed;
