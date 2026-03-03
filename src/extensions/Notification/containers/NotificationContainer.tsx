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
      if (notification.board_id && notification.card_id) {
        navigate(`/boards/${notification.board_id}?card=${notification.card_id}`);
      } else if (notification.board_id) {
        navigate(`/boards/${notification.board_id}`);
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
