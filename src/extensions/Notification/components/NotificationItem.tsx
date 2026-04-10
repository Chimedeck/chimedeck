// NotificationItem — renders a single notification row in the panel.
// Each notification type gets a distinct icon and copy so the user can
// understand the event at a glance without opening the card.
import type { FC, ComponentType, SVGProps } from 'react';
import {
  AtSymbolIcon,
  RectangleStackIcon,
  ArrowRightIcon,
  ChatBubbleLeftIcon,
  UserPlusIcon,
  UserMinusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { markReadThunk, deleteNotificationThunk } from '../slices/notificationSlice';
import type { Notification } from '../api';
import translations from '../translations/en.json';

interface Props {
  notification: Notification;
  onNavigate: (notification: Notification) => void;
}

type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

// Icon + accent colour per notification type
const TYPE_ICON: Record<string, HeroIcon> = {
  mention: AtSymbolIcon as HeroIcon,
  card_created: RectangleStackIcon as HeroIcon,
  card_moved: ArrowRightIcon as HeroIcon,
  card_commented: ChatBubbleLeftIcon as HeroIcon,
  card_member_assigned: UserPlusIcon as HeroIcon,
  card_member_unassigned: UserMinusIcon as HeroIcon,
  card_updated: PencilSquareIcon as HeroIcon,
  card_deleted: TrashIcon as HeroIcon,
  card_archived: ArchiveBoxIcon as HeroIcon,
};

const TYPE_ACCENT: Record<string, string> = {
  mention: 'text-indigo-400',
  card_created: 'text-emerald-400',
  card_moved: 'text-sky-400',
  card_commented: 'text-indigo-400',
  card_member_assigned: 'text-violet-400',
  card_member_unassigned: 'text-rose-400',
  card_updated: 'text-indigo-400',
  card_deleted: 'text-danger',
  card_archived: 'text-amber-400',
};

function buildCopy(notification: Notification): string {
  const actor = notification.actor.nickname ?? notification.actor.name ?? 'Someone';
  const card = notification.card_title ?? 'a card';

  switch (notification.type) {
    case 'card_created':
      return `${actor} created "${card}" in ${notification.board_title ?? 'a board'}`;
    case 'card_moved':
      return notification.list_title
        ? `${actor} moved "${card}" to ${notification.list_title}`
        : `${actor} moved "${card}"`;
    case 'card_commented':
      return `${actor} commented on "${card}"`;
    case 'card_member_assigned':
      return `${actor} was assigned to "${card}"`;
    case 'card_member_unassigned':
      return `${actor} was removed from "${card}"`;
    case 'card_updated':
      return `${actor} updated "${card}"`;
    case 'card_deleted':
      return `${actor} deleted "${card}"`;
    case 'card_archived':
      return `${actor} archived "${card}"`;
    case 'mention':
    default:
      return `${actor} mentioned you in "${card}"`;
  }
}

const NotificationItem: FC<Props> = ({ notification, onNavigate }) => {
  const dispatch = useAppDispatch();

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

  const Icon = TYPE_ICON[notification.type] ?? AtSymbolIcon;
  const iconAccent = TYPE_ACCENT[notification.type] ?? 'text-indigo-400';
  const copy = buildCopy(notification);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-bg-overlay/50 transition-colors ${
        notification.read ? '' : 'bg-bg-surface/60'
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {/* Type icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className={`w-4 h-4 ${iconAccent}`} aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Unread indicator dot */}
        {!notification.read && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5 mb-0.5 align-middle" aria-hidden="true" />
        )}
        <p className="text-sm text-subtle leading-snug inline">
          {copy}
        </p>
        {notification.board_title && (
          <p className="text-xs text-muted mt-0.5">{notification.board_title}</p>
        )}
        <p className="text-xs text-muted mt-0.5">
          {new Date(notification.created_at).toLocaleString()}
        </p>
      </div>

      <button
        onClick={handleDelete}
        className="shrink-0 text-muted hover:text-subtle transition-colors ml-1"
        aria-label={translations['Notifications.deleteAriaLabel']}
        tabIndex={0}
      >
        ×
      </button>
    </div>
  );
};

export default NotificationItem;
