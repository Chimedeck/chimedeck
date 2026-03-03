// NotificationItem — renders a single notification row in the panel.
import type { FC } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { markReadThunk, deleteNotificationThunk } from '../slices/notificationSlice';
import type { Notification } from '../api';

interface Props {
  notification: Notification;
  onNavigate: (notification: Notification) => void;
}

const NotificationItem: FC<Props> = ({ notification, onNavigate }) => {
  const dispatch = useAppDispatch();
  const actorLabel = notification.actor.nickname ?? notification.actor.name ?? 'Someone';

  const handleClick = () => {
    if (!notification.read) {
      dispatch(markReadThunk({ id: notification.id }));
    }
    onNavigate(notification);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(deleteNotificationThunk({ id: notification.id }));
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-700/50 transition-colors ${
        notification.read ? '' : 'bg-slate-800/60'
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {/* Unread indicator dot */}
      <div className="mt-1 shrink-0">
        {notification.read ? (
          <div className="w-2 h-2" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-indigo-400" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 leading-snug">
          <span className="font-medium">{actorLabel}</span>
          {' mentioned you in '}
          <span className="font-medium">&ldquo;{notification.card_title ?? 'a card'}&rdquo;</span>
        </p>
        {notification.board_title && (
          <p className="text-xs text-slate-400 mt-0.5">{notification.board_title}</p>
        )}
        <p className="text-xs text-slate-500 mt-0.5">
          {new Date(notification.created_at).toLocaleString()}
        </p>
      </div>

      <button
        onClick={handleDelete}
        className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors ml-1"
        aria-label="Dismiss notification"
        tabIndex={0}
      >
        ×
      </button>
    </div>
  );
};

export default NotificationItem;
