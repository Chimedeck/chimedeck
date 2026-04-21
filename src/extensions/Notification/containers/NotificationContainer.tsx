// NotificationContainer — connects Redux + WS sync; renders Bell + Panel.
// Mounted once in AppShell so notifications are globally available.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { fetchNotificationsThunk } from '../slices/notificationSlice';
import { useNotificationSync } from '../hooks/useNotificationSync';
import NotificationBell from '../components/NotificationBell';
import NotificationPanel from '../components/NotificationPanel';
import type { Notification } from '../api';
import { boardPath, cardPath } from '~/common/routing/shortUrls';

export default function NotificationContainer() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications on mount
  useEffect(() => {
    dispatch(fetchNotificationsThunk());
  }, [dispatch]);

  // Subscribe to WS notification_created events
  useNotificationSync();

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
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [panelOpen]);

  const handleNavigate = useCallback(
    (notification: Notification) => {
      const n = notification as Notification & { board_short_id?: string | null; card_short_id?: string | null };
      if (notification.board_id && notification.card_id) {
        navigate(cardPath({ id: notification.card_id, short_id: n.card_short_id ?? undefined }));
      } else if (notification.board_id) {
        navigate(boardPath({ id: notification.board_id, short_id: n.board_short_id ?? undefined }));
      }
    },
    [navigate],
  );

  return (
    <div ref={containerRef} className="relative">
      <NotificationBell onClick={() => setPanelOpen((prev) => !prev)} />
      {panelOpen && (
        <NotificationPanel onClose={() => setPanelOpen(false)} onNavigate={handleNavigate} />
      )}
    </div>
  );
}
