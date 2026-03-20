# Test: Sprint 94 — Mention + Notifications i18n

**Sprint:** 94  
**Tool:** Playwright MCP

## Setup
- Log in as a member user
- Open a board that has at least one other member

## Steps

### 1. Mention autocomplete — aria-label
1. Open a card from the board
2. In the card description / comment box, type `@`
3. Verify the suggestion dropdown `<ul>` has `aria-label="Mention suggestions"` (from `Mention.ariaList`)

### 2. Notification bell — no unread
1. Navigate to the main board page
2. Ensure there are no unread notifications
3. Verify the bell button `aria-label` is `"Open notifications"` (from `Notifications.ariaOpenPanel`)

### 3. Notification bell — with unread
1. Trigger a notification (e.g. have another user mention you)  
   _If not possible in isolation, inspect the aria-label after receiving any notification_
2. Verify the bell button `aria-label` matches `"Notifications — N unread"` where N is the unread count (from `Notifications.ariaUnread`)

### 4. Notification panel — title and mark all read
1. Click the notification bell to open the panel
2. Verify the panel `role="dialog"` `aria-label` is `"Notifications"` (from `Notifications.title`)
3. Verify the `<h2>` inside the panel reads `"Notifications"` (from `Notifications.title`)
4. Verify the "mark all read" button reads `"Mark all as read"` (from `Notifications.markAllRead`)

### 5. Notification panel — empty state
1. Mark all notifications as read and dismiss them so the panel is empty
2. Open the panel again
3. Verify the empty message reads `"You have no notifications."` (from `Notifications.empty`)

### 6. Notification panel — load more
1. Ensure there are more than one page of notifications  
   _Or inspect the button while `hasMore=true`_
2. Verify the load-more button reads `"Load more"` (from `Notifications.loadMore`)
3. While loading, verify the button reads `"Loading…"` (from `Notifications.loading`)

### 7. Notification item — dismiss button
1. In the notification panel, hover over a notification item
2. Verify the dismiss `×` button has `aria-label="Dismiss notification"` (from `Notifications.deleteAriaLabel`)

### 8. Notification Preferences panel — loading state
1. Navigate to the notification preferences settings page
2. While the preferences are loading, verify the loading text reads `"Loading notification preferences…"` (from `NotificationPreferences.loading`)

### 9. Notification Preferences panel — table headers
1. After preferences load, verify the table column headers read:
   - `"Notification"` (from `NotificationPreferences.columnNotification`)
   - `"In-App"` (from `NotificationPreferences.columnInApp`)
   - `"Email"` (from `NotificationPreferences.columnEmail`)

### 10. Notification Preferences panel — toggle aria-labels
1. Verify the In-App toggle for a row has `aria-label` containing `"— In-App"` (suffix from `NotificationPreferences.columnInApp`)
2. Verify the Email toggle for a row has `aria-label` containing `"— Email"` (suffix from `NotificationPreferences.columnEmail`)

### 11. Notification Preferences panel — disabled email tooltip
1. If email notifications are disabled on the server, hover over a disabled Email toggle
2. Verify the tooltip reads `"Email notifications are disabled on this server"` (from `NotificationPreferences.emailDisabledTooltip`)

## Acceptance Criteria
- All mention dropdown aria-labels render from `Mention/translations/en.json`
- All notification bell, panel, and item strings render from `Notification/translations/en.json`
- All notification preferences strings render from `Notifications/translations/en.json`
- No hardcoded English strings remain in `src/extensions/Mention/**/*.tsx` or `src/extensions/Notification*/**/*.tsx`
