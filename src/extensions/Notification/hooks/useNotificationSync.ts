// useNotificationSync — listens to the shared WebSocket for notification_created events
// and dispatches them into the notification Redux slice.
//
// WHY: the existing RealtimeSocket singleton is shared across the app; we subscribe
// to it here and filter for user-scoped events rather than opening a second connection.
//
// This hook handles ALL notification types (mention, card_created, card_moved,
// card_commented) — the reducer is type-agnostic, so new server-side types are
// automatically surfaced in the panel without changes to this handler.
import { useEffect } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { socket } from '~/extensions/Realtime/client/socket';
import { notificationSliceActions } from '../slices/notificationSlice';
import type { Notification } from '../api';

export function useNotificationSync(): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsubscribe = socket.subscribe({
      onEvent(event) {
        if (event.type === 'notification_created') {
          const notification = (event.payload as { notification: Notification }).notification;
          if (notification) {
            dispatch(notificationSliceActions.addNotification(notification));
          }
        }
      },
    });
    return unsubscribe;
  }, [dispatch]);
}
