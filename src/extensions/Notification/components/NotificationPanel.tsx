// NotificationPanel — slide-in panel listing recent notifications.
import { useMemo, type FC } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  selectNotifications,
  selectNotificationHasMore,
  selectNotificationLoadMoreStatus,
  markAllReadThunk,
  fetchMoreNotificationsThunk,
  clearAllNotificationsThunk,
} from '../slices/notificationSlice';
import NotificationItem from './NotificationItem';
import type { Notification } from '../api';
import translations from '../translations/en.json';
import Button from '~/common/components/Button';

interface Props {
  onClose: () => void;
  onNavigate: (notification: Notification) => void;
}

function resolveBoardCardTagKey(notification: Notification): string | null {
  if (!notification.board_id || !notification.card_id) return null;
  return `board-card:${notification.board_id}:${notification.card_id}`;
}

function resolveContinuousStackKey(notification: Notification): string | null {
  return resolveBoardCardTagKey(notification);
}

function groupContinuousCardDiscussionNotifications(
  notifications: Notification[]
): Notification[][] {
  const groups: Notification[][] = [];

  for (const notification of notifications) {
    const lastGroup = groups.at(-1);
    if (lastGroup && lastGroup.length > 0) {
      const lastGroupFirst = lastGroup.at(0);
      if (!lastGroupFirst) {
        groups.push([notification]);
        continue;
      }

      const notificationKey = resolveContinuousStackKey(notification);
      const lastGroupKey = resolveContinuousStackKey(lastGroupFirst);
      const canJoinLastGroup =
        notificationKey != null && lastGroupKey != null && notificationKey === lastGroupKey;

      if (canJoinLastGroup) {
        lastGroup.push(notification);
        continue;
      }
    }

    groups.push([notification]);
  }

  return groups;
}

const NotificationPanel: FC<Props> = ({ onClose, onNavigate }) => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectNotifications);
  const hasMore = useAppSelector(selectNotificationHasMore);
  const loadMoreStatus = useAppSelector(selectNotificationLoadMoreStatus);
  const groupedNotifications = useMemo(
    () => groupContinuousCardDiscussionNotifications(notifications),
    [notifications]
  );

  const handleMarkAllRead = () => {
    void dispatch(markAllReadThunk());
  };

  const handleClearAll = () => {
    void dispatch(clearAllNotificationsThunk());
  };

  const handleLoadMore = () => {
    void dispatch(fetchMoreNotificationsThunk());
  };

  const handleNavigate = (notification: Notification) => {
    onClose();
    onNavigate(notification);
  };

  return (
    <div
      className="absolute right-0 top-12 w-[380px] max-h-[480px] overflow-y-auto bg-bg-base border border-border rounded-xl shadow-2xl z-50"
      role="dialog"
      aria-label={translations['Notifications.title']}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-bg-base">
        <h2 className="text-sm font-semibold text-base">{translations['Notifications.title']}</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="link"
            size="sm"
            onClick={handleClearAll}
            className="text-subtle hover:text-base"
          >
            {translations['Notifications.clearAll']}
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-indigo-400 hover:text-indigo-300"
          >
            {translations['Notifications.markAllRead']}
          </Button>
        </div>
      </div>

      {/* Content */}
      {notifications.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted text-center">
          {translations['Notifications.empty']}
        </p>
      ) : (
        <>
          <div className="py-1">
            {groupedNotifications.map((group) => {
              const firstNotification = group[0];
              if (!firstNotification) return null;

              return (
                <NotificationItem
                  key={firstNotification.id}
                  notification={firstNotification}
                  {...(group.length > 1 ? { stackedNotifications: group } : {})}
                  onNavigate={handleNavigate}
                />
              );
            })}
          </div>

          {(hasMore || loadMoreStatus === 'error') && (
            <div className="px-4 py-3 text-center">
              {loadMoreStatus === 'error' ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-danger">
                    {translations['Notifications.loadMoreError']}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleLoadMore}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    {translations['Notifications.loadMore']}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loadMoreStatus === 'loading'}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  {loadMoreStatus === 'loading'
                    ? translations['Notifications.loading']
                    : translations['Notifications.loadMore']}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NotificationPanel;
