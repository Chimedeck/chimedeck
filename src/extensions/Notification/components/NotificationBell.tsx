// NotificationBell — bell icon with unread count badge.
// Shown in the AppShell top bar (md+) or mobile topbar.
import type { FC } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectUnreadCount } from '../slices/notificationSlice';
import translations from '../translations/en.json';

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
      className="relative p-2 rounded-full hover:bg-bg-surface transition-colors text-subtle hover:text-base"
      aria-label={hasUnread ? translations['Notifications.ariaUnread'].replace('{count}', label) : translations['Notifications.ariaOpenPanel']}
    >
      <BellIcon className="h-5 w-5" aria-hidden="true" />
      {hasUnread && (
        // [theme-exception] bg-red-500 is a semantic indicator for unread count
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
