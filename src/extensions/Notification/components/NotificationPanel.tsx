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
      className="absolute right-0 top-12 w-[380px] max-h-[480px] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50"
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 sticky top-0 bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-100">Notifications</h2>
        <button
          onClick={handleMarkAllRead}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Mark all read
        </button>
      </div>

      {/* Content */}
      {notifications.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">
          You have no notifications.
        </p>
      ) : (
        <>
          <div className="divide-y divide-slate-800">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onNavigate={handleNavigate} />
            ))}
          </div>

          {hasMore && (
            <div className="px-4 py-3 text-center">
              <button
                onClick={handleLoadMore}
                disabled={status === 'loading'}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
              >
                {status === 'loading' ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NotificationPanel;
