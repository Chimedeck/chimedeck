// useNotificationSync — listens to the shared WebSocket for notification_created events
// and dispatches them into the notification Redux slice.
//
// WHY: the existing RealtimeSocket singleton is shared across the app; we subscribe
// to it here and filter for user-scoped events rather than opening a second connection.
//
// This hook handles ALL notification types (mention, card_created, card_moved,
// card_commented) — the reducer is type-agnostic, so new server-side types are
// automatically surfaced in the panel without changes to this handler.
import { useEffect, useRef } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { socket } from '~/extensions/Realtime/client/socket';
import { selectAuthToken } from '~/extensions/Auth/duck/authDuck';
import { fetchNotificationsThunk, notificationSliceActions } from '../slices/notificationSlice';
import type { Notification } from '../api';

const NOTIFICATION_POLLING_INTERVAL_MS = 30_000;
const MIN_REFRESH_GAP_MS = 5_000;

export function useNotificationSync(): void {
  const dispatch = useAppDispatch();
  const authToken = useAppSelector(selectAuthToken);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    if (!authToken) return;

    const startPolling = () => {
      if (pollingTimerRef.current !== null) return;
      pollingTimerRef.current = setInterval(() => {
        void dispatch(fetchNotificationsThunk());
      }, NOTIFICATION_POLLING_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (pollingTimerRef.current === null) return;
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    };

    const refreshNotifications = () => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < MIN_REFRESH_GAP_MS) return;
      lastRefreshAtRef.current = now;
      void dispatch(fetchNotificationsThunk());
    };

    const handleWindowFocus = () => {
      if (document.visibilityState !== 'visible') return;
      refreshNotifications();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      refreshNotifications();
    };

    const handleOnline = () => {
      refreshNotifications();
    };

    const unsubscribe = socket.subscribe({
      onEvent(event) {
        if (event.type === 'notification_created') {
          const notification = (event.payload as { notification: Notification }).notification;
          if (notification) {
            dispatch(notificationSliceActions.addNotification(notification));
          }
        }
      },
      onOpen() {
        stopPolling();
        // [why] Refresh list after reconnect to capture notifications missed while disconnected.
        refreshNotifications();
      },
      onClose() {
        // [why] A single closed socket can leave tabs stale for a long reconnect period.
        // Start polling immediately so badge + toasts recover without waiting for threshold.
        startPolling();
      },
      onPollingActive() {
        startPolling();
      },
      onPollingInactive() {
        stopPolling();
      },
    });

    socket.connect({ token: authToken });
    globalThis.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    globalThis.addEventListener('online', handleOnline);

    return () => {
      stopPolling();
      globalThis.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      globalThis.removeEventListener('online', handleOnline);
      unsubscribe();
      socket.disconnect();
    };
  }, [dispatch, authToken]);
}
