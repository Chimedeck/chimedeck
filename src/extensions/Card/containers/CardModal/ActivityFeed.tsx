// ActivityFeed — unified timeline of comments and system activity events for a card.
// Renders comments as full bubbles and system events as compact single-line rows.
// Feed is sorted descending by created_at (newest first).
import { useEffect, useState } from 'react';
import CommentItem, { type Comment } from '~/extensions/Comment/components/CommentItem';
import CommentEditor from '~/extensions/Comment/components/CommentEditor';
import { getActivityEventMeta } from '../../config/activityEventLabels';
import { VISIBLE_ACTIVITY_EVENT_TYPES } from '../../config/activityEventsConfig';
import { listAttachments } from '~/extensions/Attachments/api';
import type { ActivityData } from '../../slices/cardDetailSlice';
import type { CommentData } from '../../api/cardDetail';

interface BoardMember {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  boardId?: string;
  cardId: string;
  comments: CommentData[];
  activities: ActivityData[];
  currentUserId: string;
  boardMembers?: BoardMember[];
  onAddComment: (content: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

/** Consistent avatar colour based on user id. */
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-pink-500', 'bg-yellow-500', 'bg-orange-500', 'bg-teal-500',
];
function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = Math.trunc(hash * 31 + (userId.codePointAt(i) ?? 0));
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}
function getInitials(name: string | null | undefined, email: string): string {
  const source = name || email || '?';
  const parts = source.split(/[\s@.]/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
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
  cardId,
  comments,
  activities,
  currentUserId,
  boardMembers = [],
  onAddComment,
  onEditComment,
  onDeleteComment,
}: Props) => {
  // Map of attachmentId → { thumbnail_url, content_type } for inline previews
  const [attachmentMap, setAttachmentMap] = useState<Map<string, { thumbnail_url: string | null; url: string | null; content_type: string | null }>>(new Map());

  useEffect(() => {
    const hasAttachmentEvents = activities.some((a) => a.action === 'attachment_added');
    if (!hasAttachmentEvents) return;
    listAttachments({ cardId })
      .then(({ data }) => {
        const map = new Map(data.map((a) => [a.id, { thumbnail_url: a.thumbnail_url, url: a.url, content_type: a.content_type }]));
        setAttachmentMap(map);
      })
      .catch(() => {});
  }, [cardId, activities]);

  const memberMap = new Map(boardMembers.map((m) => [m.id, m]));

  // Convert comments to feed items
  const commentItems: FeedItem[] = comments
    .filter(Boolean)
    .map((c) => ({ kind: 'comment', ts: c.created_at, comment: c as Comment }));

  // Convert system activity events to feed items (exclude comment-type events)
  const eventItems: FeedItem[] = activities
    .filter((a) => VISIBLE_ACTIVITY_EVENT_TYPES.includes(a.action))
    .map((a) => ({ kind: 'event', ts: a.created_at, activity: a }));

  // Merge and sort descending (newest first)
  const feed: FeedItem[] = [...commentItems, ...eventItems].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase text-gray-500">Activity</h3>

      <CommentEditor
        {...(boardId !== undefined ? { boardId } : {})}
        cardId={cardId}
        placeholder="Add a comment…"
        onSubmit={onAddComment}
        submitLabel="Comment"
      />

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

          // System event row: avatar + actor name + label + timestamp
          const { activity } = item;
          const meta = getActivityEventMeta(activity.action, activity.payload);
          const member = memberMap.get(activity.actor_id);
          const displayName =
            activity.actor_name ||
            activity.actor_email ||
            member?.name ||
            member?.email ||
            'Unknown';
          const initials = getInitials(
            activity.actor_name ?? member?.name,
            activity.actor_email ?? member?.email ?? activity.actor_id,
          );
          const color = avatarColor(activity.actor_id);

          // For attachment events, look up thumbnail from the attachment map
          const attachmentId = typeof activity.payload.attachmentId === 'string' ? activity.payload.attachmentId : null;
          const attachmentInfo = attachmentId ? attachmentMap.get(attachmentId) : null;
          const showThumbnail = attachmentInfo?.content_type?.startsWith('image/') && (attachmentInfo.thumbnail_url ?? attachmentInfo.url);

          return (
            <div key={`event-${activity.id}`} className="flex gap-3">
              {/* Avatar */}
              <div
                className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${color}`}
                title={displayName}
              >
                {initials}
              </div>
              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-white">{displayName}</span>
                  <span className="text-xs text-slate-400">{meta.label}</span>
                  <span className="text-xs text-slate-600 flex-shrink-0">{relativeTime(activity.created_at)}</span>
                </div>
                {showThumbnail && (
                  <img
                    src={(attachmentInfo!.thumbnail_url ?? attachmentInfo!.url)!}
                    alt={typeof activity.payload.name === 'string' ? activity.payload.name : 'attachment'}
                    className="mt-1.5 rounded border border-slate-700 max-h-24 max-w-[180px] object-cover"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityFeed;
