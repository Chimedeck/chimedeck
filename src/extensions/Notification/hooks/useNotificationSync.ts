// useNotificationSync — listens to the shared WebSocket for notification_created events
// and dispatches them into the notification Redux slice.
//
// WHY: the existing RealtimeSocket singleton is shared across the app; we subscribe
// to it here and filter for user-scoped events rather than opening a second connection.
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
