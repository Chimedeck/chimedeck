// NotificationContainer — connects Redux + WS sync; renders Bell + Panel.
// Mounted once in AppShell so notifications are globally available.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import ToastRegion from '~/common/components/ToastRegion';
import type { ToastItem } from '~/common/components/ToastRegion';
import {
  fetchNotificationsThunk,
  markReadThunk,
  selectNotifications,
  selectNotificationStatus,
} from '../slices/notificationSlice';
import { useNotificationSync } from '../hooks/useNotificationSync';
import NotificationBell from '../components/NotificationBell';
import NotificationPanel from '../components/NotificationPanel';
import type { Notification } from '../api';
import { boardPath, cardPath } from '~/common/routing/shortUrls';

function actorDisplayName(notification: Notification): string {
  return notification.actor.nickname ?? notification.actor.name ?? 'Someone';
}

function buildToastMessage(notification: Notification): string {
  const actor = actorDisplayName(notification);
  const card = notification.card_title ?? 'a card';

  switch (notification.type) {
    case 'mention':
      return `${actor} mentioned you in ${card}.`;
    case 'card_commented':
      return `${actor} commented on ${card}.`;
    case 'card_created':
      return `${actor} created ${card}.`;
    case 'card_moved':
      return notification.list_title
        ? `${actor} moved ${card} to ${notification.list_title}.`
        : `${actor} moved ${card}.`;
    case 'comment_reaction':
      return `${actor} reacted to your comment.`;
    case 'card_member_assigned':
      return `${actor} assigned you to ${card}.`;
    case 'checklist_item_assigned':
      return `${actor} assigned you to a checklist item.`;
    default:
      return `${actor} sent a new notification.`;
  }
}

function buildPopupCardNavigationUrl(notification: Notification): string | null {
  const n = notification as Notification & {
    board_short_id?: string | null;
    card_short_id?: string | null;
  };
  if (!notification.board_id || !notification.card_id) return null;

  const params = new URLSearchParams();
  const routeCardId = n.card_short_id ?? notification.card_id;
  params.set('card', routeCardId);

  if (notification.type === 'card_commented' && notification.source_id) {
    if (notification.source_parent_id) {
      params.set('comment', notification.source_parent_id);
      params.set('reply', notification.source_id);
    } else {
      params.set('comment', notification.source_id);
    }
  } else if (notification.source_type === 'comment' && notification.source_id) {
    params.set('comment', notification.source_id);
  }

  const boardUrl = boardPath({ id: notification.board_id, short_id: n.board_short_id ?? null });
  const search = params.toString();
  return search ? `${boardUrl}?${search}` : boardUrl;
}

export default function NotificationContainer() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const notifications = useAppSelector(selectNotifications);
  const notificationStatus = useAppSelector(selectNotificationStatus);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const didRequestInitialFetchRef = useRef(false);
  const hasHydratedFromInitialFetchRef = useRef(false);

  const handlePopupNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.read) {
        void dispatch(markReadThunk({ id: notification.id }));
      }

      const popupCardUrl = buildPopupCardNavigationUrl(notification);
      if (popupCardUrl) {
        navigate(popupCardUrl);
        return;
      }

      const n = notification as Notification & {
        board_short_id?: string | null;
        card_short_id?: string | null;
      };
      if (notification.board_id) {
        navigate(boardPath({ id: notification.board_id, short_id: n.board_short_id ?? null }));
        return;
      }

      if (notification.card_id) {
        navigate(cardPath({ id: notification.card_id, short_id: n.card_short_id ?? null }));
      }
    },
    [dispatch, navigate]
  );

  const buildNotificationToast = useCallback(
    (notification: Notification): ToastItem => {
      return {
        id: `notification-toast-${notification.id}`,
        message: buildToastMessage(notification),
        variant: 'info',
        durationMs: 5000,
        onClick: () => {
          handlePopupNotificationClick(notification);
        },
      };
    },
    [handlePopupNotificationClick]
  );

  // Fetch initial notifications on mount
  useEffect(() => {
    didRequestInitialFetchRef.current = true;
    void dispatch(fetchNotificationsThunk());
  }, [dispatch]);

  // Subscribe to WS notification_created events
  useNotificationSync();

  useEffect(() => {
    const known = knownNotificationIdsRef.current;

    if (!hasHydratedFromInitialFetchRef.current) {
      if (!didRequestInitialFetchRef.current || notificationStatus === 'loading') {
        return;
      }

      notifications.forEach((notification) => {
        known.add(notification.id);
      });
      hasHydratedFromInitialFetchRef.current = true;

      const unreadNotifications = notifications.filter((notification) => !notification.read);
      if (unreadNotifications.length === 0) {
        return;
      }

      setToasts((prev) => {
        const next = [...prev];

        unreadNotifications
          .slice(0, 3)
          .reverse()
          .forEach((notification) => {
            next.push(buildNotificationToast(notification));
          });

        return next.slice(-5);
      });
      return;
    }

    const unseenNotifications = notifications.filter((notification) => !known.has(notification.id));
    if (unseenNotifications.length === 0) return;

    unseenNotifications.forEach((notification) => {
      known.add(notification.id);
    });

    // [why] When the panel is open, the user can already see the incoming notifications
    // (e.g. via "Load more"). Showing toasts on top would be redundant and jarring.
    if (panelOpen) return;

    const newUnreadNotifications = unseenNotifications.filter((notification) => !notification.read);
    if (newUnreadNotifications.length === 0) return;

    setToasts((prev) => {
      const next = [...prev];

      newUnreadNotifications
        .slice(0, 3)
        .reverse()
        .forEach((notification) => {
          next.push(buildNotificationToast(notification));
        });

      return next.slice(-5);
    });
  }, [notifications, notificationStatus, buildNotificationToast, panelOpen]);

  // Close panel on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [panelOpen]);

  const handleNavigate = useCallback(
    (notification: Notification) => {
      const n = notification as Notification & {
        board_short_id?: string | null;
        card_short_id?: string | null;
      };
      if (notification.board_id && notification.card_id) {
        const params = new URLSearchParams();

        if (notification.type === 'card_commented' && notification.source_id) {
          if (notification.source_parent_id) {
            params.set('comment', notification.source_parent_id);
            params.set('reply', notification.source_id);
          } else {
            params.set('comment', notification.source_id);
          }
        } else if (notification.source_type === 'comment' && notification.source_id) {
          params.set('comment', notification.source_id);
        }

        const cardUrl = cardPath({ id: notification.card_id, short_id: n.card_short_id ?? null });
        const search = params.toString();
        navigate(search ? `${cardUrl}?${search}` : cardUrl);
      } else if (notification.board_id) {
        navigate(boardPath({ id: notification.board_id, short_id: n.board_short_id ?? null }));
      }
    },
    [navigate]
  );

  return (
    <>
      <div ref={containerRef} className="relative">
        <NotificationBell
          onClick={() => {
            setPanelOpen((prev) => !prev);
          }}
        />
        {panelOpen && (
          <NotificationPanel
            onClose={() => {
              setPanelOpen(false);
            }}
            onNavigate={handleNavigate}
          />
        )}
      </div>

      <ToastRegion
        toasts={toasts}
        onDismiss={(id) => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }}
      />
    </>
  );
}
