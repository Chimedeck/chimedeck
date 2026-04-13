// NotificationPanel — slide-in panel listing recent notifications.
import type { FC } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  selectNotifications,
  selectNotificationHasMore,
  selectNotificationStatus,
  markAllReadThunk,
  fetchMoreNotificationsThunk,
} from '../slices/notificationSlice';
import NotificationItem from './NotificationItem';
import type { Notification } from '../api';
import translations from '../translations/en.json';
import Button from '~/common/components/Button';

interface Props {
  onClose: () => void;
  onNavigate: (notification: Notification) => void;
}

const NotificationPanel: FC<Props> = ({ onClose, onNavigate }) => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectNotifications);
  const hasMore = useAppSelector(selectNotificationHasMore);
  const status = useAppSelector(selectNotificationStatus);

  const handleMarkAllRead = () => {
    dispatch(markAllReadThunk());
  };

  const handleLoadMore = () => {
    dispatch(fetchMoreNotificationsThunk());
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
        <Button variant="link" size="sm" onClick={handleMarkAllRead} className="text-indigo-400 hover:text-indigo-300">
          {translations['Notifications.markAllRead']}
        </Button>
      </div>

      {/* Content */}
      {notifications.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted text-center">
          {translations['Notifications.empty']}
        </p>
      ) : (
        <>
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onNavigate={handleNavigate} />
            ))}
          </div>

          {hasMore && (
            <div className="px-4 py-3 text-center">
              <Button
                variant="link"
                size="sm"
                onClick={handleLoadMore}
                disabled={status === 'loading'}
                className="text-indigo-400 hover:text-indigo-300"
              >
                {status === 'loading' ? translations['Notifications.loading'] : translations['Notifications.loadMore']}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NotificationPanel;
