# Sprint 71 — Notification Preferences UI

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 70 (Notification Preferences DB + API), Sprint 24 (Profile Settings page)

---

## Goal

Surface the notification preferences matrix in the existing profile / account settings page. Users see a simple table of notification types with toggle switches for each channel (In-App and Email). Changes auto-save via PATCH and the UI reflects the updated state optimistically.

---

## Scope

### 1. `src/extensions/Notifications/` (extend existing folder)

Add:

```
src/extensions/Notifications/
  NotificationPreferences/
    NotificationPreferencesPanel.tsx   # Main section — table of toggles
    notificationPreferences.slice.ts   # RTK Query extensions
    types.ts                           # NotificationPreference type
```

---

### 2. `NotificationPreferencesPanel` component

A table / list rendered inside the Profile Settings page under a **"Notification Preferences"** section heading.

Layout (one row per notification type):

```
+--------------------------+----------+---------+
| Notification             | In-App   | Email   |
+--------------------------+----------+---------+
| @Mentions                |  [toggle]| [toggle]|
| Card created             |  [toggle]| [toggle]|
| Card moved               |  [toggle]| [toggle]|
| Card commented           |  [toggle]| [toggle]|
+--------------------------+----------+---------+
```

- Each toggle is a `<Switch>` (Headless UI) styled in Tailwind.
- Toggling fires `PATCH /api/v1/notifications/preferences` with the single changed row.
- Optimistic update applied immediately; rolls back on API error with an error toast.
- Email toggles are **disabled** (greyed out with a tooltip `"Email notifications are disabled on this server"`) when `SES_ENABLED=false` or `EMAIL_NOTIFICATIONS_ENABLED=false`.

---

### 3. RTK Query endpoint (`notificationPreferences.slice.ts`)

```ts
getNotificationPreferences: builder.query<NotificationPreference[], void>({
  query: () => '/notifications/preferences',
  providesTags: ['NotificationPreferences'],
}),
updateNotificationPreferences: builder.mutation<NotificationPreference[], UpdatePreferencesBody>({
  query: (body) => ({ url: '/notifications/preferences', method: 'PATCH', body }),
  invalidatesTags: ['NotificationPreferences'],
}),
```

---

### 4. Mount in Profile Settings page

In `src/extensions/Profile/containers/ProfileSettingsPage/`:

- Import and render `<NotificationPreferencesPanel />` below the existing profile form (avatar, nickname, etc.).
- Wrapped in its own `<section>` with a `<h2>Notification Preferences</h2>` heading.

---

### 5. Feature Flag Gate

The entire `NotificationPreferencesPanel` is rendered only when `NOTIFICATION_PREFERENCES_ENABLED=true`. When the flag is off, the section is simply not rendered — no empty state needed.

---

## Files

| Path | Change |
|---|---|
| `src/extensions/Notifications/NotificationPreferences/NotificationPreferencesPanel.tsx` | New component |
| `src/extensions/Notifications/NotificationPreferences/notificationPreferences.slice.ts` | RTK Query + slice |
| `src/extensions/Notifications/NotificationPreferences/types.ts` | Shared types |
| `src/extensions/Profile/containers/ProfileSettingsPage/ProfileSettingsPage.tsx` | Mount `<NotificationPreferencesPanel />` |
| `src/reducers.ts` | Register new slice |

---

## Acceptance Criteria

- [ ] Preferences panel renders all 4 notification types with current state loaded from API
- [ ] Toggling any switch fires `PATCH` and updates UI optimistically
- [ ] API error rolls back the toggle and shows an error toast
- [ ] Email column toggles are disabled when `SES_ENABLED=false` or `EMAIL_NOTIFICATIONS_ENABLED=false`, with a tooltip explaining why
- [ ] Panel is hidden entirely when `NOTIFICATION_PREFERENCES_ENABLED=false`
- [ ] Accessible: toggles have `aria-label` matching their row + column (e.g. `"Card created — Email"`)
