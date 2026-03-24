# Sprint 96 — Profile Settings: Notifications Tab

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 71 (Notification Preferences UI), Sprint 95 (Board-scoped Notification Preferences)

---

## Goal

The current `EditProfilePage` renders profile info, email change, and notification settings as a single long vertical scroll. As the notification surface grows (per-type toggles for 9+ types across 2 channels), a tab-based layout is needed to keep the page focused and navigable.

This sprint introduces a **dedicated "Notifications" tab** inside user profile settings. The tab becomes the **master control** for all notification behaviour — global on/off, then per-type in-app vs email.

---

## Acceptance Criteria

- [ ] Profile Settings page has tabs: **Profile** (existing content) and **Notifications** (new)
- [ ] Notifications tab contains the global master toggle and the per-type preference matrix
- [ ] Notification tab can be deep-linked via URL (e.g. `/settings/profile?tab=notifications`)
- [ ] Active tab state is persisted in the URL query string (no flash on hard refresh)
- [ ] Email column in preference matrix is disabled with a tooltip when `SES_ENABLED` or `EMAIL_NOTIFICATIONS_ENABLED` is off
- [ ] All strings are in `src/extensions/UserProfile/translations/en.json`

---

## Scope

### 1. `EditProfilePage.tsx` — tab layout refactor

Introduce two tabs via local state + URL query param (`?tab=profile` or `?tab=notifications`).

**Tab: Profile**
- Avatar display (Sprint 24)
- Current account info (email)
- `ChangeEmailForm` (Sprint 40)

**Tab: Notifications**
- `GlobalNotificationToggle` (Sprint 95) at the top — master on/off
- Visual divider + heading: "Per-type preferences"
- `NotificationPreferencesPanel` (Sprint 71) — the full type × channel toggle matrix
- Note text beneath: _"These settings apply across all boards. Board settings can further refine per-board behaviour."_ (links to board settings)

Tab selection is read from `?tab=` query param via `useSearchParams`. Default is `profile`.

```tsx
// [why] URL-driven tab state keeps the active tab after page refresh and
// allows deep-linking from the notification email footer.
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = searchParams.get('tab') ?? 'profile';
```

---

### 2. Translations — extend `src/extensions/UserProfile/translations/en.json`

```json
{
  "UserProfile.tabProfile": "Profile",
  "UserProfile.tabNotifications": "Notifications",
  "UserProfile.notificationsSubheading": "Per-type preferences",
  "UserProfile.notificationsMasterNote": "These settings apply across all boards. Board settings can further refine per-board behaviour."
}
```

Remove the `UserProfile.notifications` and `UserProfile.notificationPreferences` keys that are no longer used as standalone section headings (they become tab content headings).

---

### 3. `GlobalNotificationToggle.tsx` — heading update

The component currently renders without its own `<h2>` heading (the parent page provided it via `UserProfile.notifications` key). Add a self-contained heading inside the component for the Notifications tab context:

```tsx
<h2 className="text-base font-semibold text-slate-100 mb-4">
  {translations['GlobalNotificationToggle.heading']}
</h2>
```

Add to `translations/en.json`:
```json
"GlobalNotificationToggle.heading": "Master notifications toggle"
```

---

### 4. URL deep-link from email footer

The unsubscribe / settings link in all notification emails (Sprint 72) currently points to `/settings/profile#notifications`. Update to `/settings/profile?tab=notifications` to match the new tab routing.

Update `server/extensions/notifications/mods/emailTemplates/shared.ts`:

```ts
const settingsUrl = `${baseUrl}/settings/profile?tab=notifications`;
```

---

## File Checklist

| File | Change |
|------|--------|
| `src/extensions/UserProfile/containers/EditProfilePage/EditProfilePage.tsx` | Tab layout, `useSearchParams` |
| `src/extensions/UserProfile/translations/en.json` | Add tab keys, remove old section keys |
| `src/extensions/UserProfile/containers/EditProfilePage/GlobalNotificationToggle.tsx` | Add self-contained heading |
| `server/extensions/notifications/mods/emailTemplates/shared.ts` | Fix deep-link URL |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | Load `/settings/profile` | Profile tab is active by default |
| T2 | Click "Notifications" tab | URL updates to `?tab=notifications`, Notifications content renders |
| T3 | Load `/settings/profile?tab=notifications` directly | Notifications tab is pre-selected |
| T4 | Notifications tab with `NOTIFICATION_PREFERENCES_ENABLED=false` | Only global toggle shown, per-type matrix hidden |
| T5 | Notifications tab with `SES_ENABLED=false` | Email column toggles are disabled with tooltip |
