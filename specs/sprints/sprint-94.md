# Sprint 94 — i18n Phase 5: Remaining Extensions & Common/Layout Components

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 90–93 (i18n Phases 1–4)
> **References:** Existing pattern in `src/extensions/Card/translations/en.json`

---

## Goal

Complete the i18n effort by extracting hard-coded English strings from the remaining extension folders that still lack translation files, and from shared `src/common/` and `src/layout/` components.

Extensions covered this sprint:

- **Mention** (autocomplete dropdown, mention chips)
- **Notifications / Notification** (top-level notification panel strings not yet in existing JSON)
- **UserProfile** (profile settings page strings not yet in existing User JSON)
- **AdminInvite** (invite modal, credential sheet)
- **Realtime** (connection status banners)
- **OfflineDrafts** (draft save/restore banners)
- **DeveloperDocs** (any UI labels)
- **BoardViews** (view switcher labels not covered by BoardViewSwitcher)
- **src/common/** and **src/layout/** (shared component strings)

After this sprint the entire codebase has zero hardcoded English UI strings.

---

## Scope

### 1. Mention Extension

**Existing or new:** `src/extensions/Mention/translations/en.json`

```json
{
  "Mention.searchPlaceholder": "Search members…",
  "Mention.noResults": "No members found",
  "Mention.ariaList": "Mention suggestions",
  "Mention.chipAriaRemove": "Remove mention"
}
```

---

### 2. Notifications Extension

The existing `src/extensions/Notification/translations/en.json` covers some keys. Audit both `Notification/` and `Notifications/` for any remaining hardcoded strings and extend the relevant JSON.

Additional keys likely needed:

```json
{
  "Notifications.markAllRead": "Mark all as read",
  "Notifications.clearAll": "Clear all",
  "Notifications.settingsLink": "Notification settings",
  "Notifications.ariaOpenPanel": "Open notifications",
  "Notifications.ariaClosePanel": "Close notifications",
  "Notifications.loadMore": "Load more",
  "Notifications.today": "Today",
  "Notifications.earlier": "Earlier"
}
```

---

### 3. UserProfile Extension

The existing `src/extensions/User/translations/en.json` covers profile-page strings. Audit `src/extensions/UserProfile/` for any strings that are not yet covered in `User/translations/en.json`, and extend or create a separate `UserProfile/translations/en.json`:

```json
{
  "UserProfile.avatarAlt": "Profile avatar",
  "UserProfile.changeAvatarButton": "Change photo",
  "UserProfile.removeAvatarButton": "Remove photo",
  "UserProfile.saveButton": "Save Changes",
  "UserProfile.cancelButton": "Cancel",
  "UserProfile.successMessage": "Profile updated",
  "UserProfile.errorMessage": "Failed to save changes. Please try again."
}
```

---

### 4. AdminInvite Extension

**New file:** `src/extensions/AdminInvite/translations/en.json`

```json
{
  "AdminInvite.modalTitle": "Invite User",
  "AdminInvite.emailLabel": "Email address",
  "AdminInvite.emailPlaceholder": "user@example.com",
  "AdminInvite.passwordModeLabel": "Password mode",
  "AdminInvite.passwordModeAuto": "Auto-generate",
  "AdminInvite.passwordModeManual": "Set manually",
  "AdminInvite.passwordLabel": "Password",
  "AdminInvite.sendEmailToggle": "Send invitation email",
  "AdminInvite.autoVerifyToggle": "Auto-verify email",
  "AdminInvite.submitButton": "Invite",
  "AdminInvite.cancelButton": "Cancel",
  "AdminInvite.credentialSheetTitle": "User Credentials",
  "AdminInvite.credentialSheetCopy": "Copy these credentials now — the password will not be shown again.",
  "AdminInvite.copyButton": "Copy",
  "AdminInvite.copiedStatus": "Copied!",
  "AdminInvite.closeButton": "Close"
}
```

---

### 5. Realtime Extension

**New file:** `src/extensions/Realtime/translations/en.json`

```json
{
  "Realtime.statusLive": "Live",
  "Realtime.statusConnecting": "Connecting…",
  "Realtime.statusReconnecting": "Reconnecting…",
  "Realtime.statusOffline": "Offline — changes may not sync",
  "Realtime.statusError": "Connection error",
  "Realtime.ariaStatus": "Real-time connection status"
}
```

---

### 6. OfflineDrafts Extension

**New file:** `src/extensions/OfflineDrafts/translations/en.json`

```json
{
  "OfflineDrafts.draftBanner": "You have an unsaved draft",
  "OfflineDrafts.restoreButton": "Restore draft",
  "OfflineDrafts.discardButton": "Discard",
  "OfflineDrafts.savedIndicator": "Draft saved",
  "OfflineDrafts.syncingIndicator": "Syncing draft…",
  "OfflineDrafts.ariaClose": "Dismiss draft banner"
}
```

---

### 7. BoardViews Extension

**New file:** `src/extensions/BoardViews/translations/en.json`

```json
{
  "BoardViews.ariaViewSwitcher": "Switch board view",
  "BoardViews.kanban": "Kanban",
  "BoardViews.table": "Table",
  "BoardViews.calendar": "Calendar",
  "BoardViews.timeline": "Timeline"
}
```

---

### 8. Common & Layout Components

**New file or extension of existing:** `src/common/translations/en.json`

Cover strings in shared utility components under `src/common/` and `src/layout/` (modals, toasts, confirmations, navigation, empty states):

```json
{
  "Common.confirmDelete": "Are you sure? This cannot be undone.",
  "Common.confirmButton": "Confirm",
  "Common.cancelButton": "Cancel",
  "Common.closeButton": "Close",
  "Common.loadingLabel": "Loading…",
  "Common.errorGeneric": "Something went wrong. Please try again.",
  "Common.emptyState": "Nothing here yet",
  "Common.ariaCloseModal": "Close modal",
  "Common.ariaOpenMenu": "Open menu",
  "Common.ariaCloseMenu": "Close menu",

  "Layout.sidebarAriaLabel": "Main navigation",
  "Layout.topbarAriaLabel": "Top navigation",
  "Layout.skipToContent": "Skip to main content"
}
```

---

## File Checklist

| File | Change |
|------|--------|
| `src/extensions/Mention/translations/en.json` | **Create** |
| `src/extensions/Notification/translations/en.json` | **Extend** with missing keys |
| `src/extensions/Notifications/translations/en.json` | **Extend** with missing keys |
| `src/extensions/UserProfile/translations/en.json` | **Create** (or extend `User/`) |
| `src/extensions/AdminInvite/translations/en.json` | **Create** |
| `src/extensions/Realtime/translations/en.json` | **Create** |
| `src/extensions/OfflineDrafts/translations/en.json` | **Create** |
| `src/extensions/BoardViews/translations/en.json` | **Create** |
| `src/common/translations/en.json` | **Create** |
| `src/extensions/Mention/**/*.tsx` | Update |
| `src/extensions/Notification*/**/*.tsx` | Update |
| `src/extensions/UserProfile/**/*.tsx` | Update |
| `src/extensions/AdminInvite/**/*.tsx` | Update |
| `src/extensions/Realtime/**/*.tsx` | Update |
| `src/extensions/OfflineDrafts/**/*.tsx` | Update |
| `src/extensions/BoardViews/**/*.tsx` | Update |
| `src/common/**/*.tsx` | Update |
| `src/layout/**/*.tsx` | Update |

---

## Acceptance Criteria

- [ ] All remaining extension folders that had hardcoded strings now have `translations/en.json`
- [ ] `src/common/translations/en.json` exists and covers shared modal, toast, and navigation copy
- [ ] No hardcoded English strings remain anywhere in `src/extensions/`, `src/common/`, or `src/layout/`
- [ ] Running a grep for common English words (`"Cancel"`, `"Close"`, `"Loading"`, `"Save"`, `aria-label="`) across `src/` returns zero hardcoded instances
- [ ] Components use `translations['Key']` bracket notation throughout
- [ ] No new i18n library introduced
- [ ] All UI behaviour is unchanged after the refactor — this sprint is a pure text extraction with no logic changes
