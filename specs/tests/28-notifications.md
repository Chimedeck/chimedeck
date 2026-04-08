# 28. Notifications

**Prerequisites:** Flow 13 (Comments & Mentions) completed. A mention notification was triggered.  
**Continues from:** Any page, logged in as admin.  
**Ends with:** Notification read, all notifications marked as read, bell badge cleared.

---

## Steps

### Unread Badge

1. Look at the notification bell icon in the top bar.
   - **Expected:** A red badge or count indicator shows at least `1` unread notification (from the mention in flow 13).

2. The bell aria-label should read something like `Notifications — 1 unread`.

### Open Notifications

3. Click the notification bell.
   - **Expected:** Notification panel/dropdown opens with the heading `Notifications`.

4. Locate the mention notification (e.g. `Admin User mentioned you in Test Card 1`).
   - **Expected:** Notification item is visible and unread (bold or highlighted).

5. Click the notification.
   - **Expected:** Panel closes and the card detail modal for `Test Card 1` opens (or the app navigates to that card).

### Mark All as Read

6. Reopen the notification panel.

7. Click **Mark all as read**.
   - **Expected:** All notifications are dimmed / marked read. The bell badge clears.

8. Verify the bell icon shows no badge.

### Empty State

9. If no more unread notifications exist, verify the empty state message (e.g. `You have no notifications`) is present after all are read.

---

## Notes

- Continue to flow **29-notification-preferences**.
