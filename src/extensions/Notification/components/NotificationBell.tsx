// NotificationBell — bell icon with unread count badge.
// Shown in the AppShell top bar (md+) or mobile topbar.
import type { FC } from 'react';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectUnreadCount } from '../slices/notificationSlice';

interface Props {
  onClick: () => void;
}

const NotificationBell: FC<Props> = ({ onClick }) => {
  const unreadCount = useAppSelector(selectUnreadCount);
  const label = unreadCount > 99 ? '99+' : String(unreadCount);
  const hasUnread = unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
      aria-label={hasUnread ? `Notifications — ${label} unread` : 'Notifications'}
    >
      🔔
      {hasUnread && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1"
          aria-hidden="true"
        >
          {label}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
