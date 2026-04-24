// NotificationItem — renders a single notification row in the panel.
// Each notification type gets distinct copy and grouped content so the user
// can understand the event at a glance without opening the card.
import { type FC, type MouseEvent, type SyntheticEvent } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectCurrentUser } from '~/slices/authSlice';
import CommentReactions from '~/extensions/Comment/components/CommentReactions';
import { markReadThunk, deleteNotificationThunk, notificationSliceActions } from '../slices/notificationSlice';
import { notificationApi, type Notification, type NotificationCommentReaction } from '../api';
import translations from '../translations/en.json';

interface Props {
  notification: Notification;
  stackedNotifications?: Notification[];
  onNavigate: (notification: Notification) => void;
}

function resolveTargetUserCopy({
  notification,
  currentUserId,
}: {
  notification: Notification;
  currentUserId: string | null;
}): { isCurrentUser: boolean; targetName: string } {
  const targetUserId = notification.target_user_id ?? null;
  const hasCurrentUser = currentUserId != null && currentUserId !== '';
  const isCurrentUser = hasCurrentUser
    ? targetUserId != null && targetUserId === currentUserId
    : true;

  return {
    isCurrentUser,
    targetName: notification.target_user_name ?? 'a member',
  };
}

function buildActionCopy(notification: Notification, currentUserId: string | null): string {
  const card = notification.card_title ?? 'this card';
  const { isCurrentUser, targetName } = resolveTargetUserCopy({ notification, currentUserId });

  switch (notification.type) {
    case 'card_created':
      return 'created this card';
    case 'card_moved':
      return notification.list_title
        ? `moved this card to ${notification.list_title}`
        : 'moved this card';
    case 'card_commented':
      return 'commented on this card';
    case 'comment_reaction': {
      const emoji = notification.emoji ?? '❤️';
      return `reacted ${emoji} to your comment`;
    }
    case 'card_member_assigned':
      return isCurrentUser ? `assigned you to ${card}` : `assigned ${targetName} to ${card}`;
    case 'card_member_unassigned':
      return isCurrentUser ? `removed you from ${card}` : `removed ${targetName} from ${card}`;
    case 'checklist_item_assigned':
      return isCurrentUser
        ? `assigned you to a checklist item in ${card}`
        : `assigned ${targetName} to a checklist item in ${card}`;
    case 'checklist_item_unassigned':
      return isCurrentUser
        ? `removed you from a checklist item in ${card}`
        : `removed ${targetName} from a checklist item in ${card}`;
    case 'checklist_item_due_date_updated':
      return `updated a checklist due date in ${card}`;
    case 'card_updated':
      return `updated ${card}`;
    case 'card_deleted':
      return `deleted ${card}`;
    case 'card_archived':
      return `archived ${card}`;
    case 'mention':
    default:
      return 'mentioned you';
  }
}

function extractCommentPreview(content: string | null | undefined): string | null {
  if (!content) return null;

  const plainText = content
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, ' ') // markdown image syntax
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1') // markdown links -> link text
    .replaceAll(/[>#*_`~]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

  if (!plainText) return null;
  if (plainText.length <= 160) return plainText;
  return `${plainText.slice(0, 159).trimEnd()}…`;
}

function actorDisplayName(notification: Notification): string {
  return notification.actor.nickname ?? notification.actor.name ?? 'Someone';
}

function actorInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return `${first}${second}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function addReactionOptimistic({
  reactions,
  emoji,
  userId,
  userName,
}: {
  reactions: NotificationCommentReaction[];
  emoji: string;
  userId: string;
  userName: string;
}): NotificationCommentReaction[] {
  const index = reactions.findIndex((reaction) => reaction.emoji === emoji);
  if (index === -1) {
    return [
      ...reactions,
      {
        emoji,
        count: 1,
        reactedByMe: true,
        reactors: [{ userId, name: userName }],
      },
    ];
  }

  const existing = reactions[index];
  if (!existing) return reactions;
  if (existing.reactedByMe) return reactions;

  const hasReactor = existing.reactors.some((reactor) => reactor.userId === userId);
  const updated: NotificationCommentReaction = {
    ...existing,
    count: existing.count + 1,
    reactedByMe: true,
    reactors: hasReactor
      ? existing.reactors
      : [...existing.reactors, { userId, name: userName }],
  };

  const next = [...reactions];
  next[index] = updated;
  return next.sort((a, b) => b.count - a.count);
}

function removeReactionOptimistic({
  reactions,
  emoji,
  userId,
}: {
  reactions: NotificationCommentReaction[];
  emoji: string;
  userId: string;
}): NotificationCommentReaction[] {
  const index = reactions.findIndex((reaction) => reaction.emoji === emoji);
  if (index === -1) return reactions;

  const existing = reactions[index];
  if (!existing?.reactedByMe) return reactions;

  const nextCount = Math.max(0, existing.count - 1);
  if (nextCount === 0) {
    return reactions.filter((reaction) => reaction.emoji !== emoji);
  }

  const updated: NotificationCommentReaction = {
    ...existing,
    count: nextCount,
    reactedByMe: false,
    reactors: existing.reactors.filter((reactor) => reactor.userId !== userId),
  };

  const next = [...reactions];
  next[index] = updated;
  return next.sort((a, b) => b.count - a.count);
}

function formatNotificationTime(notification: Notification): string | null {
  const notificationPayload = notification as unknown as {
    created_at?: string;
    createdAt?: string;
    timestamp?: string;
  };
  // Some realtime payloads may use camelCase/time aliases.
  const rawCreatedAt = notificationPayload.created_at ?? notificationPayload.createdAt ?? notificationPayload.timestamp;

  if (!rawCreatedAt) return null;

  const date = new Date(rawCreatedAt);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString();
}

const NotificationItem: FC<Props> = ({ notification, stackedNotifications, onNavigate }) => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectCurrentUser);
  const notificationsInStack = stackedNotifications ?? [notification];
  const primaryNotification = notificationsInStack[0] ?? notification;

  const handleClick = (entry: Notification) => {
    if (!entry.read) {
      void dispatch(markReadThunk({ id: entry.id }));
    }
    onNavigate(entry);
  };

  const handleDelete = (entry: Notification, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    void dispatch(deleteNotificationThunk({ id: entry.id }));
  };

  const canReactToComment = (entry: Notification) => Boolean(entry.source_id)
    && entry.type !== 'comment_reaction'
    && (
      entry.type === 'card_commented'
      || entry.source_type === 'comment'
    );

  const setCommentReactionsInStore = (entryId: string, reactions: NotificationCommentReaction[]) => {
    dispatch(notificationSliceActions.setNotificationCommentReactions({
      id: entryId,
      reactions,
    }));
  };

  const handleAddReaction = async (entry: Notification, emoji: string) => {
    if (!canReactToComment(entry) || !entry.source_id || !currentUser?.id) return;

    const previousReactions = entry.comment_reactions ?? [];
    const optimisticReactions = addReactionOptimistic({
      reactions: previousReactions,
      emoji,
      userId: currentUser.id,
      userName: currentUser.name || currentUser.email,
    });

    setCommentReactionsInStore(entry.id, optimisticReactions);

    try {
      await notificationApi.addCommentReaction({ commentId: entry.source_id, emoji });
    } catch {
      setCommentReactionsInStore(entry.id, previousReactions);
    }
  };

  const handleRemoveReaction = async (entry: Notification, emoji: string) => {
    if (!canReactToComment(entry) || !entry.source_id || !currentUser?.id) return;

    const previousReactions = entry.comment_reactions ?? [];
    const optimisticReactions = removeReactionOptimistic({
      reactions: previousReactions,
      emoji,
      userId: currentUser.id,
    });

    setCommentReactionsInStore(entry.id, optimisticReactions);

    try {
      await notificationApi.removeCommentReaction({ commentId: entry.source_id, emoji });
    } catch {
      setCommentReactionsInStore(entry.id, previousReactions);
    }
  };

  const stopInteractionBubbling = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const cardTitle = primaryNotification.card_title ?? 'Untitled card';
  const locationLabel = [primaryNotification.board_title, primaryNotification.list_title]
    .filter((value): value is string => Boolean(value))
    .join(': ');

  return (
    <div
      className="mx-2 my-2 rounded-xl border border-border bg-bg-surface cursor-pointer transition-all"
    >
      <div className="px-3 py-3">
        <div className="space-y-2">
          <div className="min-w-0">
            <div className="min-w-0">
              <button
                type="button"
                className="inline-flex max-w-full rounded-md border border-border bg-bg-overlay px-2.5 py-1 text-left hover:bg-bg-sunken transition-colors"
                onClick={() => {
                  handleClick(primaryNotification);
                }}
                aria-label={`Open card ${cardTitle}`}
              >
                <p className="truncate text-sm font-semibold text-base">{cardTitle}</p>
              </button>
              {locationLabel && (
                <p className="mt-1 text-xs text-muted">{locationLabel}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {notificationsInStack.map((entry) => {
              const activityCopy = buildActionCopy(entry, currentUser?.id ?? null);
              const createdTime = formatNotificationTime(entry);
              const actorName = actorDisplayName(entry);
              const commentPreview = extractCommentPreview(entry.comment_content);
              const commentReactions = entry.comment_reactions ?? [];
              const canReact = canReactToComment(entry);

              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border bg-bg-overlay px-2.5 py-2 transition-colors hover:bg-bg-overlay/80"
                  onClick={() => {
                    handleClick(entry);
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleClick(entry);
                    }
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-bg-surface border border-border overflow-hidden flex items-center justify-center text-[10px] font-semibold text-subtle">
                      {entry.actor.avatar_url
                        ? <img src={entry.actor.avatar_url} alt={actorName} className="h-full w-full object-cover" />
                        : actorInitials(actorName)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="text-sm font-semibold text-base">{actorName}</p>
                          {createdTime && <p className="text-xs text-muted">{createdTime}</p>}
                        </div>
                        <button
                          onClick={(event) => {
                            handleDelete(entry, event);
                          }}
                          className="shrink-0 text-muted hover:text-subtle transition-colors"
                          aria-label={translations['Notifications.deleteAriaLabel']}
                          tabIndex={0}
                        >
                          ×
                        </button>
                      </div>

                      <p className="mt-0.5 text-sm text-subtle">{activityCopy}</p>

                      {commentPreview && (
                        <p className="mt-1.5 rounded-md border border-border bg-bg-surface px-2 py-1.5 text-xs text-subtle leading-relaxed">
                          {commentPreview}
                        </p>
                      )}

                      {canReact && (
                        <div
                          className="mt-2"
                          onClick={stopInteractionBubbling}
                          onMouseDown={stopInteractionBubbling}
                          onKeyDown={stopInteractionBubbling}
                        >
                          <CommentReactions
                            reactions={commentReactions}
                            onAdd={(emoji) => {
                              void handleAddReaction(entry, emoji);
                            }}
                            onRemove={(emoji) => {
                              void handleRemoveReaction(entry, emoji);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
